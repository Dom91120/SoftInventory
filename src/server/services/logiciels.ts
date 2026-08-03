import type { Prisma } from "@/generated/prisma/client";
import { compareAlpha } from "@/lib/format";
import type {
  ConsultationInput,
  ContratInput,
  DevisInput,
  LogicielInput,
  LogicielRgpdInput,
} from "@/schemas/logiciel";
import { prisma } from "@/server/db";
import { deleteDocument } from "@/server/services/documents";

// Couche données de l'inventaire. Fonctions fines, non gardées (les gardes
// vivent dans les server actions).

/** Filtres de la liste (tous optionnels, combinables). */
export type FiltresLogiciels = {
  q?: string;
  editeurId?: number;
  serviceId?: number;
  criticiteId?: number;
  technologieId?: number;
  hebergement?: "saas" | "on_premise" | "hybride";
  statut?: "evaluation" | "production" | "fin_de_vie" | "abandonne";
};

function buildWhere(f: FiltresLogiciels): Prisma.LogicielWhereInput {
  return {
    ...(f.q ? { nom: { contains: f.q, mode: "insensitive" } } : {}),
    ...(f.editeurId ? { editeurId: f.editeurId } : {}),
    ...(f.serviceId ? { services: { some: { serviceId: f.serviceId } } } : {}),
    ...(f.criticiteId ? { criticiteId: f.criticiteId } : {}),
    ...(f.technologieId ? { technologieId: f.technologieId } : {}),
    ...(f.hebergement ? { hebergement: f.hebergement } : {}),
    ...(f.statut ? { statut: f.statut } : {}),
  };
}

export async function listLogiciels(filtres: FiltresLogiciels = {}) {
  const logiciels = await prisma.logiciel.findMany({
    where: buildWhere(filtres),
    // `orderBy` ne suffit pas (voir `compareAlpha`) mais reste utile : il donne
    // un ordre d'entrée stable, donc un départage identique des homonymes.
    orderBy: [{ nom: "asc" }, { id: "asc" }],
    include: {
      editeur: { select: { nom: true } },
      technologie: { select: { label: true } },
      criticite: { select: { label: true, couleur: true, rank: true } },
      services: { select: { service: { select: { nom: true } } } },
    },
  });
  return logiciels.sort((a, b) => compareAlpha(a.nom, b.nom));
}

export function getLogiciel(id: number) {
  return prisma.logiciel.findUnique({
    where: { id },
    include: {
      editeur: true,
      technologie: true,
      criticite: true,
      services: { include: { service: true } },
      serveurs: { include: { serveur: true } },
      contrats: {
        orderBy: [{ dateRenouvellement: "asc" }, { id: "asc" }],
        include: {
          fournisseur: { select: { id: true, nom: true } },
          documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
        },
      },
      // Consultations les plus récentes en tête ; à l'intérieur, le devis
      // retenu remonte d'abord — c'est l'information que l'on cherche.
      consultations: {
        orderBy: [{ date: "desc" }, { id: "desc" }],
        include: {
          devis: {
            orderBy: [{ retenu: "desc" }, { montant: "asc" }, { id: "asc" }],
            include: {
              fournisseur: { select: { id: true, nom: true } },
              documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
      interconnexionsSource: { include: { cible: { select: { id: true, nom: true } } } },
      interconnexionsCible: { include: { source: { select: { id: true, nom: true } } } },
    },
  });
}

export function createLogiciel(data: LogicielInput) {
  return prisma.logiciel.create({ data });
}

export function updateLogiciel(id: number, data: LogicielInput) {
  // La date de fin de contrat pilote un rappel : si elle change, le marqueur
  // anti-doublon doit être remis à zéro pour que la NOUVELLE échéance soit
  // rappelée. On ne le remet à zéro que sur changement effectif.
  return prisma.$transaction(async (tx) => {
    const avant = await tx.logiciel.findUnique({ where: { id }, select: { finContratLe: true } });
    const dateChangee = avant?.finContratLe?.getTime() !== data.finContratLe?.getTime();
    return tx.logiciel.update({
      where: { id },
      data: { ...data, ...(dateChangee ? { rappelEnvoyeLe: null } : {}) },
    });
  });
}

export function updateLogicielRgpd(id: number, data: LogicielRgpdInput) {
  return prisma.logiciel.update({ where: { id }, data });
}

export function deleteLogiciel(id: number) {
  return prisma.logiciel.delete({ where: { id } });
}

// ── Liaisons ──

/** Remplace la liste des services utilisateurs (delta en une transaction). */
export function setServices(logicielId: number, serviceIds: number[]) {
  return prisma.$transaction([
    prisma.logicielService.deleteMany({
      where: { logicielId, serviceId: { notIn: serviceIds } },
    }),
    ...serviceIds.map((serviceId) =>
      prisma.logicielService.upsert({
        where: { logicielId_serviceId: { logicielId, serviceId } },
        update: {},
        create: { logicielId, serviceId },
      }),
    ),
  ]);
}

export function addServeur(
  logicielId: number,
  serveurId: number,
  environnement: "production" | "test" | "recette" | "formation",
) {
  return prisma.logicielServeur.upsert({
    where: { logicielId_serveurId_environnement: { logicielId, serveurId, environnement } },
    update: {},
    create: { logicielId, serveurId, environnement },
  });
}

export function removeServeur(
  logicielId: number,
  serveurId: number,
  environnement: "production" | "test" | "recette" | "formation",
) {
  return prisma.logicielServeur.deleteMany({
    where: { logicielId, serveurId, environnement },
  });
}

export function addInterconnexion(sourceId: number, cibleId: number, description: string) {
  return prisma.interconnexion.upsert({
    where: { sourceId_cibleId: { sourceId, cibleId } },
    update: { description },
    create: { sourceId, cibleId, description },
  });
}

export function removeInterconnexion(id: number) {
  return prisma.interconnexion.delete({ where: { id } });
}

/**
 * Logiciels précédent et suivant dans l'ordre alphabétique — celui de la
 * liste, pour que « suivant » mène bien à la ligne d'en dessous.
 *
 * On charge les noms et on prend le voisin en mémoire plutôt que de faire deux
 * requêtes `nom < …` / `nom > …` : c'est EXACTEMENT le tri de la liste
 * (`compareAlpha`), donc les deux ordres ne peuvent pas diverger — a fortiori
 * depuis que le tri se fait hors SQL —, et deux logiciels homonymes ne
 * bloquent pas la navigation (un `nom >` ne saurait pas les départager). Sur
 * quelques centaines de lignes, le coût est négligeable.
 */
export async function voisinsLogiciel(id: number): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = (
    await prisma.logiciel.findMany({
      orderBy: [{ nom: "asc" }, { id: "asc" }],
      select: { id: true, nom: true },
    })
  ).sort((a, b) => compareAlpha(a.nom, b.nom));
  const i = tous.findIndex((l) => l.id === id);
  if (i === -1) return { precedent: null, suivant: null };
  return { precedent: tous[i - 1] ?? null, suivant: tous[i + 1] ?? null };
}

/** Candidats à une interconnexion : tous les logiciels sauf celui-ci. */
export async function listAutresLogiciels(saufId: number) {
  const autres = await prisma.logiciel.findMany({
    where: { id: { not: saufId } },
    orderBy: [{ nom: "asc" }, { id: "asc" }],
    select: { id: true, nom: true },
  });
  return autres.sort((a, b) => compareAlpha(a.nom, b.nom));
}

// ── Contrats ──

export function createContrat(logicielId: number, data: ContratInput) {
  return prisma.contrat.create({ data: { logicielId, ...data } });
}

export function updateContrat(id: number, data: ContratInput) {
  // Même règle que finContratLe : nouvelle date de renouvellement ⇒ nouveau rappel.
  return prisma.$transaction(async (tx) => {
    const avant = await tx.contrat.findUnique({
      where: { id },
      select: { dateRenouvellement: true },
    });
    const dateChangee = avant?.dateRenouvellement?.getTime() !== data.dateRenouvellement?.getTime();
    return tx.contrat.update({
      where: { id },
      data: { ...data, ...(dateChangee ? { rappelEnvoyeLe: null } : {}) },
    });
  });
}

export function deleteContrat(id: number) {
  return prisma.contrat.delete({ where: { id } });
}

/** Pièces jointes d'une ligne de contrat (garde-fou anti-orphelins). */
export function compterPiecesContrat(id: number) {
  return prisma.document.count({ where: { contratId: id } });
}

/**
 * Pièces qu'emporterait la suppression d'un logiciel. TROIS chemins de cascade
 * mènent à `documents` : la fiche elle-même, ses lignes de contrat, et les
 * devis de ses consultations. Les oublier laisserait le garde-fou passoire.
 */
export function compterPiecesLogiciel(id: number) {
  return prisma.document.count({
    where: {
      OR: [
        { logicielId: id },
        { contrat: { logicielId: id } },
        { devis: { consultation: { logicielId: id } } },
      ],
    },
  });
}

export function getContrat(id: number) {
  return prisma.contrat.findUnique({ where: { id } });
}

// ── Consultations et devis ──

export function createConsultation(logicielId: number, data: ConsultationInput) {
  return prisma.consultation.create({ data: { logicielId, ...data } });
}

export function updateConsultation(id: number, data: ConsultationInput) {
  return prisma.consultation.update({ where: { id }, data });
}

/**
 * Supprime la consultation ET ses devis (cascade en base). À n'appeler que si
 * plus aucune pièce n'y pend : la cascade efface les LIGNES `documents` côté
 * PostgreSQL, ce qui court-circuite le `unlink` de deleteDocument et laisserait
 * les fichiers orphelins dans attachments/. Voir compterPiecesConsultation.
 */
export function deleteConsultation(id: number) {
  return prisma.consultation.delete({ where: { id } });
}

/** Pièces jointes sous une consultation, tous devis confondus. */
export function compterPiecesConsultation(id: number) {
  return prisma.document.count({ where: { devis: { consultationId: id } } });
}

export function getConsultation(id: number) {
  return prisma.consultation.findUnique({ where: { id } });
}

export function createDevis(consultationId: number, data: DevisInput) {
  return prisma.devis.create({ data: { consultationId, ...data } });
}

/** Ne touche PAS à `retenu` : la marque se pilote par marquerDevisRetenu. */
export function updateDevis(id: number, data: DevisInput) {
  return prisma.devis.update({ where: { id }, data });
}

/**
 * Supprime le devis ET sa pièce jointe, d'un seul geste.
 *
 * C'est la SEULE suppression de l'application qui ne soit pas bloquée par ses
 * pièces, et c'est possible parce qu'elle ne s'en remet pas à la cascade
 * PostgreSQL : chaque pièce passe par deleteDocument, qui retire aussi le
 * fichier du disque. Un devis, c'est une ligne et son PDF — les séparer n'aurait
 * pas de sens.
 *
 * Les pièces d'abord : si la suppression du devis échouait ensuite, mieux vaut
 * des lignes de devis sans pièce que des fichiers orphelins dans attachments/.
 */
export async function deleteDevisAvecPieces(id: number) {
  const pieces = await prisma.document.findMany({ where: { devisId: id }, select: { id: true } });
  for (const p of pieces) await deleteDocument(p.id);
  return prisma.devis.delete({ where: { id } });
}

export function getDevis(id: number) {
  return prisma.devis.findUnique({
    where: { id },
    include: { consultation: { select: { id: true, logicielId: true } } },
  });
}

/**
 * Marque (ou démarque) le devis retenu. C'est ICI que tient l'invariant « au
 * plus un retenu par consultation » : la démarque des frères et la marque du
 * devis se font dans la même transaction, sinon deux clics rapprochés
 * laisseraient deux devis marqués.
 */
export function marquerDevisRetenu(id: number, retenu: boolean) {
  return prisma.$transaction(async (tx) => {
    const devis = await tx.devis.findUnique({ where: { id }, select: { consultationId: true } });
    if (!devis) return null;
    if (retenu) {
      await tx.devis.updateMany({
        where: { consultationId: devis.consultationId, id: { not: id } },
        data: { retenu: false },
      });
    }
    return tx.devis.update({ where: { id }, data: { retenu } });
  });
}
