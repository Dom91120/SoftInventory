import { dateCalendaire, prochaineEcheanceApres } from "@/lib/taches-core";
import type { TacheInput } from "@/schemas/tache";
import { prisma } from "@/server/db";

export function listTachesDuLogiciel(logicielId: number) {
  return prisma.tacheRecurrente.findMany({
    where: { logicielId },
    orderBy: [{ statut: "asc" }, { prochaineEcheance: "asc" }],
    include: {
      typeTache: true,
      assigne: { select: { id: true, prenom: true, nom: true, email: true } },
      executions: { orderBy: { faitLe: "desc" }, take: 10 },
    },
  });
}

/** Vue globale : tâches actives triées par échéance + historique récent. */
export function listTachesGlobales() {
  return prisma.tacheRecurrente.findMany({
    where: { statut: { not: "terminee" } },
    orderBy: { prochaineEcheance: "asc" },
    include: {
      logiciel: { select: { id: true, nom: true } },
      typeTache: true,
      assigne: { select: { prenom: true, nom: true, email: true } },
    },
  });
}

export function listExecutionsRecentes(limite = 20) {
  return prisma.tacheExecution.findMany({
    orderBy: { faitLe: "desc" },
    take: limite,
    include: {
      tache: { include: { logiciel: { select: { id: true, nom: true } } } },
    },
  });
}

export function getTache(id: number) {
  return prisma.tacheRecurrente.findUnique({ where: { id } });
}

export function createTache(logicielId: number, data: TacheInput) {
  return prisma.tacheRecurrente.create({ data: { logicielId, ...data } });
}

export function updateTache(id: number, data: TacheInput) {
  // Nouvelle échéance saisie à la main ⇒ le rappel de l'ancienne occurrence ne
  // vaut plus : remise à zéro de l'anti-doublon sur changement effectif.
  return prisma.$transaction(async (tx) => {
    const avant = await tx.tacheRecurrente.findUnique({
      where: { id },
      select: { prochaineEcheance: true },
    });
    const dateChangee = avant?.prochaineEcheance.getTime() !== data.prochaineEcheance.getTime();
    return tx.tacheRecurrente.update({
      where: { id },
      data: { ...data, ...(dateChangee ? { rappelEnvoyePour: null } : {}) },
    });
  });
}

export function deleteTache(id: number) {
  return prisma.tacheRecurrente.delete({ where: { id } });
}

/**
 * Complète l'occurrence courante (transaction) :
 *  1. historise l'exécution (échéance prévue + acteur dénormalisé) ;
 *  2. ponctuelle → statut terminé ; sinon échéance suivante (ancrée sur la
 *     prévue, cf. lib/taches-core) + remise à zéro de l'anti-doublon de rappel.
 */
export async function completerTache(
  id: number,
  acteur: { id: string; label: string },
  commentaire: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return prisma.$transaction(async (tx) => {
    const tache = await tx.tacheRecurrente.findUnique({ where: { id } });
    if (!tache) return { ok: false, error: "Tâche introuvable." };
    if (tache.statut === "terminee") {
      return { ok: false, error: "Cette tâche est déjà terminée." };
    }

    await tx.tacheExecution.create({
      data: {
        tacheId: id,
        echeancePrevue: tache.prochaineEcheance,
        faitParId: acteur.id,
        faitParLabel: acteur.label,
        commentaire,
      },
    });

    const suivante = prochaineEcheanceApres(
      tache.prochaineEcheance,
      tache.periodicite,
      tache.moisPersonnalises,
      dateCalendaire(new Date()),
    );
    await tx.tacheRecurrente.update({
      where: { id },
      data: suivante
        ? { prochaineEcheance: suivante, rappelEnvoyePour: null }
        : { statut: "terminee" },
    });
    return { ok: true };
  });
}
