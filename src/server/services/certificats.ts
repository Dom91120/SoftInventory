import type { Prisma } from "@/generated/prisma/client";
import type { Civilite } from "@/generated/prisma/enums";
import {
  type CertificatInput,
  type CodesCertificatInput,
  nomTitulaire,
} from "@/schemas/certificat";
import { prisma } from "@/server/db";
import { deleteDocument } from "@/server/services/documents";

/**
 * Certificats électroniques — couche données. Fonctions fines, non gardées :
 * les gardes vivent dans les server actions.
 *
 * LE CODE DE RÉVOCATION NE SORT PAS D'ICI par les lectures ordinaires :
 * `SANS_CODES` le retire de chaque `findMany`/`findUnique`. Un compte lecteur
 * ne peut donc pas l'obtenir, même en lisant la réponse du serveur dans son
 * navigateur — la garde est dans la requête, pas dans le rendu. Une seule
 * fonction le lit, `getCodesCertificat`, et l'action qui l'appelle exige le
 * rôle admin.
 */

/** Ce que toute lecture ordinaire laisse en base. */
const SANS_CODES = { codeRevocation: true } as const;

/** Filtres de la liste, tous facultatifs et cumulatifs. */
export type FiltresCertificats = {
  q?: string;
  fournisseurId?: number;
  serviceId?: number;
  statut?: "valide" | "revoque" | "suspendu";
  usage?: "signature" | "authentification" | "cachet" | "autre";
};

function buildWhere(f: FiltresCertificats): Prisma.CertificatWhereInput {
  const q = f.q?.trim();
  return {
    // La recherche porte sur le NOM, le PRÉNOM et le numéro de série : dans
    // cette liste, on part d'un nom (« qui a un certificat ? ») ou d'un numéro
    // relevé sur le support. La fonction et le service ont leurs propres
    // filtres. Le prénom y figure depuis qu'il a sa colonne : il se cherchait
    // très bien tant qu'il était collé au patronyme, et l'en sortir sans
    // l'ajouter ici aurait retiré à la recherche ce qu'elle savait déjà faire.
    ...(q
      ? {
          OR: [
            { titulaire: { contains: q, mode: "insensitive" } },
            { prenom: { contains: q, mode: "insensitive" } },
            { numeroSerie: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(f.fournisseurId ? { fournisseurId: f.fournisseurId } : {}),
    ...(f.serviceId ? { serviceId: f.serviceId } : {}),
    ...(f.statut ? { statut: f.statut } : {}),
    ...(f.usage ? { usage: f.usage } : {}),
  };
}

/**
 * La liste, par ÉCHÉANCE CROISSANTE — et non par ordre alphabétique comme les
 * autres écrans. Ce qu'on vient y chercher, c'est ce qui expire bientôt : la
 * page répond à la question avant qu'on la pose. Les certificats sans date de
 * fin ferment la marche plutôt que de l'ouvrir (PostgreSQL remonte les NULL en
 * tête en ordre croissant), le titulaire départageant les ex æquo.
 */
export async function listCertificats(filtres: FiltresCertificats = {}) {
  return prisma.certificat.findMany({
    where: buildWhere(filtres),
    omit: SANS_CODES,
    orderBy: [{ dateFin: { sort: "asc", nulls: "last" } }, { titulaire: "asc" }, { id: "asc" }],
    include: {
      fournisseur: { select: { id: true, nom: true } },
      service: { select: { id: true, nom: true } },
      serveur: { select: { id: true, nom: true } },
    },
  });
}

/** Fiche d'un certificat, codes exclus, avec ses pièces jointes. */
export async function getCertificat(id: number) {
  return prisma.certificat.findUnique({
    where: { id },
    omit: SANS_CODES,
    include: {
      fournisseur: { select: { id: true, nom: true } },
      service: { select: { id: true, nom: true } },
      serveur: { select: { id: true, nom: true } },
      // Les plus récentes en tête : sur une fiche, c'est la dernière pièce
      // déposée qu'on vient chercher.
      documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

/**
 * Les deux codes, et rien d'autre. Appelée UNIQUEMENT depuis une action qui a
 * exigé le rôle admin — le service ne sait pas qui l'interroge, c'est à
 * l'appelant de le savoir.
 */
export async function getCodesCertificat(id: number) {
  return prisma.certificat.findUnique({
    where: { id },
    select: { codeRevocation: true },
  });
}

export async function createCertificat(data: CertificatInput) {
  return prisma.certificat.create({ data, omit: SANS_CODES });
}

/**
 * Mise à jour des champs de la fiche. Les codes n'en font pas partie : ils ont
 * leur propre formulaire, donc leur propre écriture.
 *
 * Changer la date de fin REMET le témoin de rappel à zéro : le mail déjà parti
 * annonçait l'ancienne échéance, il doit repartir pour la nouvelle. Même
 * mécanique que les marchés.
 */
export async function updateCertificat(id: number, data: CertificatInput) {
  const avant = await prisma.certificat.findUnique({ where: { id }, select: { dateFin: true } });
  const echeanceChangee = avant?.dateFin?.getTime() !== data.dateFin?.getTime();
  return prisma.certificat.update({
    where: { id },
    data: { ...data, ...(echeanceChangee ? { rappelEnvoyeLe: null } : {}) },
    omit: SANS_CODES,
  });
}

/** Écriture des seuls codes (action réservée aux admins). */
export async function updateCodesCertificat(id: number, data: CodesCertificatInput) {
  await prisma.certificat.update({ where: { id }, data });
}

/**
 * Supprime le certificat ET ses pièces jointes, FICHIERS DU DISQUE COMPRIS.
 *
 * La cascade de la base emporterait les lignes, jamais les fichiers : ils
 * resteraient sur le disque sans plus rien pour les nommer ni les atteindre.
 * On passe donc par `deleteDocument`, qui efface les deux.
 */
export async function deleteCertificat(id: number) {
  const documents = await prisma.document.findMany({
    where: { certificatId: id },
    select: { id: true },
  });
  for (const d of documents) await deleteDocument(d.id);
  await prisma.certificat.delete({ where: { id } });
}

/**
 * Fiches voisines, pour les flèches de l'en-tête.
 *
 * Dans l'ORDRE DE LA LISTE, c'est-à-dire par échéance croissante — et non par
 * ordre alphabétique comme les logiciels. C'est le seul choix cohérent : la
 * flèche « suivant » doit mener où le regard irait en descendant la liste, et
 * celle-ci n'est pas rangée par nom. Parcourir les certificats du plus pressant
 * au plus lointain est d'ailleurs le geste qu'on vient faire ici.
 *
 * Le tri est refait EN MÉMOIRE sur les mêmes clés que `listCertificats` : la
 * liste étant courte, cela évite de dupliquer un `orderBy` qui divergerait.
 */
export async function voisinsCertificat(id: number): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = await prisma.certificat.findMany({
    orderBy: [{ dateFin: { sort: "asc", nulls: "last" } }, { titulaire: "asc" }, { id: "asc" }],
    select: { id: true, civilite: true, titulaire: true, prenom: true },
  });
  const i = tous.findIndex((c) => c.id === id);
  if (i === -1) return { precedent: null, suivant: null };
  const nommer = (c?: {
    id: number;
    civilite: Civilite | null;
    titulaire: string;
    prenom: string;
  }) => (c ? { id: c.id, nom: nomTitulaire(c) } : null);
  return { precedent: nommer(tous[i - 1]), suivant: nommer(tous[i + 1]) };
}

/** Les sociétés qui ont délivré au moins un certificat — options du filtre. */
export async function listAutoritesCertification() {
  return prisma.editeur.findMany({
    where: { certificats: { some: {} } },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}
