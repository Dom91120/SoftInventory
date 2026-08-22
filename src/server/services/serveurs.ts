import type { TypeOs } from "@/generated/prisma/client";
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

/**
 * Le parc avec ce que chaque machine porte — l'écran Serveurs, ses deux vues,
 * et son export. `q` cherche dans ce que la liste MONTRE : le nom, l'emplacement,
 * le système et les logiciels installés — « Ciril » trouve SRV-CIRIL comme la
 * machine qui porte CIVIL Net RH. `typeOs` restreint à une famille.
 */
export function listServeursAvecLogiciels(filtres: { q?: string; typeOs?: TypeOs } = {}) {
  const q = filtres.q?.trim();
  return prisma.serveur.findMany({
    where: {
      ...(filtres.typeOs ? { typeOs: filtres.typeOs } : {}),
      ...(q
        ? {
            OR: [
              { nom: { contains: q, mode: "insensitive" } },
              { localisation: { contains: q, mode: "insensitive" } },
              { os: { contains: q, mode: "insensitive" } },
              { logiciels: { some: { logiciel: { nom: { contains: q, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    },
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
    },
  });
}

/**
 * Serveurs précédent et suivant DANS L'ORDRE DE LA LISTE — alphabétique, celui
 * des deux vues de l'écran Serveurs. Même approche que `voisinsEditeur` : on
 * relit la liste des seuls noms, on s'y repère, et les deux ordres ne peuvent
 * donc pas diverger. L'`id` départage : `nom` est unique, mais le tri doit
 * rester stable quoi qu'il arrive.
 */
export async function voisinsServeur(id: number): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = await prisma.serveur.findMany({
    orderBy: [{ nom: "asc" }, { id: "asc" }],
    select: { id: true, nom: true },
  });
  const i = tous.findIndex((s) => s.id === id);
  if (i === -1) return { precedent: null, suivant: null };
  return { precedent: tous[i - 1] ?? null, suivant: tous[i + 1] ?? null };
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
