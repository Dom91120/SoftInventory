import type { ServeurInput } from "@/schemas/serveur";
import { prisma } from "@/server/db";

// ════════════════════════════════════════════════════════════════════════════
//  Serveurs — accès aux données.
//
//  Le serveur a sa TABLE (`serveurs`) et, désormais, sa fiche : il se crée, se
//  modifie et se supprime depuis l'écran Serveurs, plus depuis Référentiels.
//  D'où ce service à lui, séparé de `referentiels.ts` où il n'était qu'une
//  liste de valeurs parmi huit.
// ════════════════════════════════════════════════════════════════════════════

/** La liste nue, pour les listes déroulantes (fiche logiciel, certificats). */
export function listServeurs() {
  return prisma.serveur.findMany({ orderBy: { nom: "asc" } });
}

/** Le parc avec ce que chaque machine porte — l'écran Serveurs, ses deux vues. */
export function listServeursAvecLogiciels() {
  return prisma.serveur.findMany({
    orderBy: { nom: "asc" },
    include: {
      logiciels: {
        include: { logiciel: { select: { id: true, nom: true } } },
        orderBy: { logiciel: { nom: "asc" } },
      },
    },
  });
}

/**
 * La fiche : le serveur, ses installations et ses certificats. Ces deux
 * rattachements ne se saisissent pas ici — l'installation depuis l'onglet
 * Liaisons du logiciel, le certificat depuis sa propre fiche — mais ils
 * décident de ce qu'une suppression emporterait, et la fiche doit le dire.
 */
export function getServeur(id: number) {
  return prisma.serveur.findUnique({
    where: { id },
    include: {
      logiciels: {
        include: { logiciel: { select: { id: true, nom: true } } },
        orderBy: { logiciel: { nom: "asc" } },
      },
      // Un COMPTE suffit : la fiche ne les liste pas, elle prévient seulement
      // de ce qu'une suppression délierait.
      _count: { select: { certificats: true } },
    },
  });
}

export function createServeur(data: ServeurInput) {
  return prisma.serveur.create({ data });
}

export function updateServeur(id: number, data: ServeurInput) {
  return prisma.serveur.update({ where: { id }, data });
}

export function deleteServeur(id: number) {
  return prisma.serveur.delete({ where: { id } });
}
