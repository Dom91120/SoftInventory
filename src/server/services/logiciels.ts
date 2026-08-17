import type { Prisma } from "@/generated/prisma/client";
import { compareAlpha } from "@/lib/format";
import type {
  ConsultationInput,
  ContratInput,
  DevisInput,
  LogicielInput,
  LogicielRgpdInput,
  PieceContratInput,
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
  hebergement?: "saas" | "on_premise" | "hybride";
  statut?: "evaluation" | "production" | "fin_de_vie" | "abandonne";
};

function buildWhere(f: FiltresLogiciels): Prisma.LogicielWhereInput {
  return {
    ...(f.q ? { nom: { contains: f.q, mode: "insensitive" } } : {}),
    ...(f.editeurId ? { editeurId: f.editeurId } : {}),
    ...(f.serviceId ? { services: { some: { serviceId: f.serviceId } } } : {}),
    ...(f.criticiteId ? { criticiteId: f.criticiteId } : {}),
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

/**
 * Fiche complète. Les marchés sont APLATIS puis triés en mémoire : la table de
 * liaison n'intéresse personne en aval, et l'onglet Contrats/Marchés continue
 * de lire `logiciel.contrats[i].libelle` comme avant la bascule vers le marché
 * autonome.
 *
 * Les plus RÉCENTS en tête, comme les consultations. Le rang se lit sur la date
 * de début — celle à laquelle le marché a pris effet — puis sur la date de fin
 * pour ceux qui n'ont que celle-là ; sans date, le marché passe en dernier
 * plutôt qu'en tête (l'ordre décroissant de PostgreSQL remonte les NULL).
 */
export async function getLogiciel(id: number) {
  const logiciel = await getLogicielBrut(id);
  if (!logiciel) return null;
  const rang = (d: Date | null) => (d === null ? Number.NEGATIVE_INFINITY : d.getTime());
  const contrats = logiciel.contrats
    .map((l) => l.contrat)
    .sort(
      (a, b) =>
        rang(b.dateDebut) - rang(a.dateDebut) || rang(b.dateFin) - rang(a.dateFin) || b.id - a.id,
    );
  return { ...logiciel, contrats };
}

function getLogicielBrut(id: number) {
  return prisma.logiciel.findUnique({
    where: { id },
    include: {
      editeur: true,
      technologie: true,
      criticite: true,
      services: { include: { service: true } },
      serveurs: { include: { serveur: true } },
      // Marchés les plus RÉCENTS en tête, comme les consultations plus bas. Le
      // rang se lit sur la date de début — celle à laquelle le marché a pris
      // effet — puis sur la date de fin pour ceux qui n'ont que celle-là.
      //
      // `nulls: "last"` est indispensable : en tri décroissant, PostgreSQL
      // remonte les NULL en PREMIER, si bien qu'un marché sans date saisie
      // coifferait tous les autres.
      //
      // Le marché ne dépend plus du logiciel : on passe par la table de
      // liaison, et le tri se fait en mémoire (voir getLogiciel) — trier sur
      // une relation traversée coûterait une jointure pour dix lignes.
      contrats: {
        select: {
          contrat: {
            include: {
              fournisseur: { select: { id: true, nom: true } },
              logiciels: { select: { logiciel: { select: { id: true, nom: true } } } },
              pieces: {
                orderBy: [{ datePiece: "asc" }, { id: "asc" }],
                include: {
                  documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
                },
              },
            },
          },
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

// Plus de transaction ni de remise à zéro du marqueur de rappel : la fiche ne
// porte plus de date de fin de contrat. C'est le MARCHÉ qui tient l'échéance,
// et `updateContrat` fait ce travail pour lui.
export function updateLogiciel(id: number, data: LogicielInput) {
  return prisma.logiciel.update({ where: { id }, data });
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

export function addServeur(logicielId: number, serveurId: number) {
  return prisma.logicielServeur.upsert({
    where: { logicielId_serveurId: { logicielId, serveurId } },
    update: {},
    create: { logicielId, serveurId },
  });
}

export function removeServeur(logicielId: number, serveurId: number) {
  return prisma.logicielServeur.deleteMany({ where: { logicielId, serveurId } });
}

/**
 * Le marqueur « ce logiciel ne s'installe sur aucune machine du parc ».
 *
 * Il REFUSE de se poser sur un logiciel qui porte des installations : les deux
 * réponses s'excluent, et le geste raisonnable n'est pas d'effacer les
 * secondes au profit de la première — c'est de dire qu'on se contredit. La
 * carte masque déjà la case dès qu'une machine est déclarée ; cette garde est
 * là parce qu'une case absente n'engage à rien.
 */
export async function setSansServeur(logicielId: number, sansServeur: boolean) {
  if (sansServeur) {
    const installations = await prisma.logicielServeur.count({ where: { logicielId } });
    if (installations > 0) {
      throw new Error(
        `Ce logiciel est déclaré sur ${installations} machine(s) du parc : retirez ces installations avant de dire qu'il ne s'installe sur aucune.`,
      );
    }
  }
  return prisma.logiciel.update({ where: { id: logicielId }, data: { sansServeur } });
}

export function addInterconnexion(sourceId: number, cibleId: number, description: string) {
  return prisma.interconnexion.upsert({
    where: { sourceId_cibleId: { sourceId, cibleId } },
    update: { description },
    create: { sourceId, cibleId, description },
  });
}

/**
 * La description seule se reprend en place. Les deux bouts du flux, eux, ne se
 * modifient pas : ils FONT l'interconnexion — en changer un ne corrige pas la
 * ligne, il en désigne une autre. On la retire et on la déclare à nouveau.
 *
 * Rend la ligne mise à jour : l'appelant a besoin de ses deux extrémités pour
 * rafraîchir les deux fiches où elle paraît.
 */
export function setDescriptionInterconnexion(id: number, description: string) {
  return prisma.interconnexion.update({ where: { id }, data: { description } });
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

/**
 * La liste nue de l'inventaire — les options de la carte « Logiciels installés »
 * d'un serveur, où l'on désigne ce qui tourne sur la machine.
 */
export async function listLogicielsNoms() {
  const tous = await prisma.logiciel.findMany({
    orderBy: [{ nom: "asc" }, { id: "asc" }],
    select: { id: true, nom: true },
  });
  return tous.sort((a, b) => compareAlpha(a.nom, b.nom));
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

// ── Contrats et marchés ──
//
// Le marché a son propre écran (services/contrats.ts) ; ce qui reste ici sert
// l'onglet du logiciel, où l'on crée un marché DÉJÀ rattaché à la fiche ouverte.

/** Crée le marché et le rattache au logiciel depuis lequel on l'a saisi. */
export function createContrat(logicielId: number, data: ContratInput) {
  return prisma.contrat.create({
    data: { ...data, logiciels: { create: { logicielId } } },
  });
}

export function updateContrat(id: number, data: ContratInput) {
  // Même règle que finContratLe : nouvelle date de fin ⇒ nouveau rappel. Le
  // marqueur ne se remet à zéro que sur changement effectif, sinon chaque
  // enregistrement rouvrirait la porte à un doublon.
  return prisma.$transaction(async (tx) => {
    const avant = await tx.contrat.findUnique({ where: { id }, select: { dateFin: true } });
    const dateChangee = avant?.dateFin?.getTime() !== data.dateFin?.getTime();
    return tx.contrat.update({
      where: { id },
      data: { ...data, ...(dateChangee ? { rappelEnvoyeLe: null } : {}) },
    });
  });
}

/**
 * Supprime le contrat, ses lignes ET leurs pièces, d'un seul geste — même
 * traitement que deleteDevisAvecPieces, et pour la même raison : chaque pièce
 * passe par deleteDocument, qui retire aussi le fichier du disque. La cascade
 * PostgreSQL effacerait les lignes en laissant les fichiers orphelins.
 *
 * Les pièces d'abord : si la suppression échouait ensuite, mieux vaut un
 * contrat sans pièce que des fichiers orphelins dans attachments/.
 */
export async function deleteContrat(id: number) {
  const pieces = await prisma.document.findMany({
    where: { pieceContrat: { contratId: id } },
    select: { id: true },
  });
  for (const p of pieces) await deleteDocument(p.id);
  return prisma.contrat.delete({ where: { id } });
}

export function createPieceContrat(contratId: number, data: PieceContratInput) {
  return prisma.pieceContrat.create({ data: { contratId, ...data } });
}

// Plus de transaction ni de remise à zéro : aucun rappel n'est accroché à la
// pièce depuis que l'échéance est portée par le marché.
export function updatePieceContrat(id: number, data: PieceContratInput) {
  return prisma.pieceContrat.update({ where: { id }, data });
}

/** Supprime la pièce ET ses fichiers — voir deleteContrat pour le pourquoi. */
export async function deletePieceContrat(id: number) {
  const pieces = await prisma.document.findMany({
    where: { pieceContratId: id },
    select: { id: true },
  });
  for (const p of pieces) await deleteDocument(p.id);
  return prisma.pieceContrat.delete({ where: { id } });
}

export function getPieceContrat(id: number) {
  return prisma.pieceContrat.findUnique({
    where: { id },
    include: {
      contrat: {
        select: { id: true, logiciels: { select: { logicielId: true } } },
      },
    },
  });
}

/**
 * Pièces qu'emporterait la suppression d'un logiciel. DEUX chemins de cascade
 * mènent à `documents` : la fiche elle-même et les devis de ses consultations.
 *
 * Les pièces de marché n'en font plus partie : le marché survit à la
 * suppression du logiciel (il en couvre peut-être d'autres), seul le
 * rattachement disparaît. Les compter ici bloquerait une suppression sans
 * raison — rien ne serait effacé de leur côté.
 */
export function compterPiecesLogiciel(id: number) {
  return prisma.document.count({
    where: {
      OR: [{ logicielId: id }, { devis: { consultation: { logicielId: id } } }],
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
