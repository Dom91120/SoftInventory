import type { Prisma } from "@/generated/prisma/client";
import type { Civilite } from "@/generated/prisma/enums";
import { compareAlpha } from "@/lib/format";
import type { SensTri } from "@/lib/tri";
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

// ── Tri de la liste, au clic sur une colonne ────────────────────────────────
// Vit ici et non près de l'écran : la liste, l'export CSV et les flèches d'une
// fiche s'en servent, et un ordre qui diffère entre eux se remarquerait aussitôt.
// Même mécanique que la liste des marchés.

/** Les cinq colonnes de la liste, dans leur ordre d'affichage. */
export const TRIS_CERTIFICAT = ["titulaire", "service", "autorite", "validite", "modele"] as const;
export type TriCertificat = (typeof TRIS_CERTIFICAT)[number];

/**
 * Sens PROPOSÉ au premier clic sur une colonne, celui qui répond à la question
 * qu'on se pose en la cliquant. Les colonnes de texte se parcourent de A à Z ;
 * la VALIDITÉ part du plus pressant — c'est l'ordre dans lequel la liste
 * s'ouvre, et celui pour lequel on vient.
 */
export const SENS_PAR_DEFAUT_CERTIFICAT: Record<TriCertificat, SensTri> = {
  titulaire: "asc",
  service: "asc",
  autorite: "asc",
  validite: "asc",
  modele: "asc",
};

/** Ce dont on dispose pour trier : ce que la liste affiche, et rien de plus. */
type LigneTriable = {
  id: number;
  titulaire: string;
  prenom: string;
  dateFin: Date | null;
  niveau: string;
  service: { nom: string } | null;
  fournisseur: { nom: string } | null;
};

/**
 * Le titulaire se trie sur DEUX clés — le NOM puis le PRÉNOM, comme un
 * annuaire : les dix-sept « MARTIN » se rangent alors entre eux par prénom au
 * lieu de rester dans l'ordre où la base les a rendus.
 *
 * Et jamais sur `nomTitulaire()`, qui est pourtant ce que la colonne AFFICHE :
 * la civilité qu'elle place en tête rangerait toutes les « Mme » avant tous
 * les « M. », et un tri par nom qui commence par séparer les femmes des hommes
 * ne répond à aucune question.
 *
 * Sert aussi de DÉPARTAGE aux quatre autres colonnes : sans lui, les trente
 * certificats d'une même autorité resteraient dans un ordre arbitraire.
 */
function comparerTitulaires(a: LigneTriable, b: LigneTriable): number {
  return compareAlpha(a.titulaire, b.titulaire) || compareAlpha(a.prenom, b.prenom);
}

/**
 * La valeur sur laquelle une colonne se trie — `null` quand la ligne n'en a
 * pas. La colonne VALIDITÉ se trie sur la date de FIN : c'est l'échéance
 * qu'elle annonce et que surveillent les rappels ; la pastille qui la double
 * n'ajoute rien à l'ordre. Le titulaire n'est pas ici — il a son comparateur,
 * qui compte deux clés.
 */
function valeurDeTri(
  c: LigneTriable,
  tri: Exclude<TriCertificat, "titulaire">,
): string | number | null {
  switch (tri) {
    case "service":
      return c.service?.nom ?? null;
    case "autorite":
      return c.fournisseur?.nom ?? null;
    case "validite":
      return c.dateFin?.getTime() ?? null;
    case "modele":
      return c.niveau || null;
  }
}

/**
 * Tri de la liste sur la colonne cliquée. En MÉMOIRE et non en base : le tri
 * alphabétique est celui d'`Intl.Collator` (accents et casse à la française),
 * que la collation du serveur PostgreSQL ne garantit pas — voir `compareAlpha`.
 *
 * SANS PARAMÈTRE d'URL, l'appelant demande « validite / asc » et retrouve
 * exactement l'ordre historique de la liste : par échéance croissante, sans
 * terme en dernier, les ex æquo départagés par le nom puis le prénom.
 */
export function trierCertificats<T extends LigneTriable>(
  certificats: T[],
  tri: TriCertificat,
  sens: SensTri,
): T[] {
  const signe = sens === "asc" ? 1 : -1;
  return [...certificats].sort((a, b) => {
    if (tri === "titulaire") return comparerTitulaires(a, b) * signe || a.id - b.id;
    const va = valeurDeTri(a, tri);
    const vb = valeurDeTri(b, tri);
    if (va === null || vb === null) {
      // Ce qui n'a pas de valeur ferme la marche dans les DEUX sens : inverser
      // une colonne, c'est retourner ce qu'elle porte, pas remonter en tête les
      // lignes qui ne la remplissent pas.
      if (va !== vb) return va === null ? 1 : -1;
    } else {
      const ecart = typeof va === "string" ? compareAlpha(va, vb as string) : va - (vb as number);
      if (ecart) return ecart * signe;
    }
    return comparerTitulaires(a, b) || a.id - b.id;
  });
}

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
 * Dans l'ORDRE DE LA LISTE, qui lui est TRANSMIS depuis l'écran dont on vient —
 * comme sur les marchés. Les deux ne peuvent donc pas diverger, y compris quand
 * une colonne a été triée au clic : la flèche « suivant » mène toujours où le
 * regard irait en descendant la liste. Sans paramètre, c'est l'échéance
 * croissante — du plus pressant au plus lointain, le geste qu'on vient faire
 * ici, et non l'ordre alphabétique des logiciels.
 *
 * Le tri est refait EN MÉMOIRE par la même fonction que la liste : dupliquer un
 * `orderBy` aurait fini par diverger, et la liste est courte.
 *
 * Les filtres de la liste, eux, ne s'appliquent pas : les flèches parcourent
 * tous les certificats. Une fiche atteinte par un lien collé n'a pas de filtre
 * à hériter.
 */
export async function voisinsCertificat(
  id: number,
  tri: TriCertificat = "validite",
  sens: SensTri = "asc",
): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = trierCertificats(
    await prisma.certificat.findMany({
      select: {
        id: true,
        civilite: true,
        titulaire: true,
        prenom: true,
        dateFin: true,
        niveau: true,
        service: { select: { nom: true } },
        fournisseur: { select: { nom: true } },
      },
    }),
    tri,
    sens,
  );
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
