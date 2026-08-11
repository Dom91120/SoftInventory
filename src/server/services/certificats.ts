import type { Prisma } from "@/generated/prisma/client";
import type { CertificatInput, CodesCertificatInput } from "@/schemas/certificat";
import { prisma } from "@/server/db";

/**
 * Certificats électroniques — couche données. Fonctions fines, non gardées :
 * les gardes vivent dans les server actions.
 *
 * LES DEUX CODES (révocation, retrait) NE SORTENT PAS D'ICI par les lectures
 * ordinaires : `SANS_CODES` les retire de chaque `findMany`/`findUnique`. Un
 * compte lecteur ne peut donc pas les obtenir, même en lisant la réponse du
 * serveur dans son navigateur — la garde est dans la requête, pas dans le
 * rendu. Une seule fonction les lit, `getCodesCertificat`, et l'action qui
 * l'appelle exige le rôle admin.
 */

/** Ce que toute lecture ordinaire laisse en base. */
const SANS_CODES = { codeRevocation: true, codeRetrait: true } as const;

/** Filtres de la liste, tous facultatifs et cumulatifs. */
export type FiltresCertificats = {
  q?: string;
  fournisseurId?: number;
  serviceId?: number;
  statut?: "actif" | "en_renouvellement" | "revoque";
  usage?: "signature" | "authentification" | "cachet" | "autre";
};

function buildWhere(f: FiltresCertificats): Prisma.CertificatWhereInput {
  const q = f.q?.trim();
  return {
    // La recherche porte sur le TITULAIRE et le numéro de série : dans cette
    // liste, on part d'un nom (« qui a un certificat ? ») ou d'un numéro relevé
    // sur le support. La fonction et le service ont leurs propres filtres.
    ...(q
      ? {
          OR: [
            { titulaire: { contains: q, mode: "insensitive" } },
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

/** Fiche d'un certificat, codes exclus. */
export async function getCertificat(id: number) {
  return prisma.certificat.findUnique({
    where: { id },
    omit: SANS_CODES,
    include: {
      fournisseur: { select: { id: true, nom: true } },
      service: { select: { id: true, nom: true } },
      serveur: { select: { id: true, nom: true } },
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
    select: { codeRevocation: true, codeRetrait: true },
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

export async function deleteCertificat(id: number) {
  await prisma.certificat.delete({ where: { id } });
}

/** Les sociétés qui ont délivré au moins un certificat — options du filtre. */
export async function listAutoritesCertification() {
  return prisma.editeur.findMany({
    where: { certificats: { some: {} } },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}
