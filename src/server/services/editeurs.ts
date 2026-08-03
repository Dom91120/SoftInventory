import { compareAlpha } from "@/lib/format";
import type { EditeurInput } from "@/schemas/editeur";
import { prisma } from "@/server/db";

export async function listEditeurs() {
  const editeurs = await prisma.editeur.findMany({ orderBy: [{ nom: "asc" }, { id: "asc" }] });
  return editeurs.sort((a, b) => compareAlpha(a.nom, b.nom));
}

export function getEditeur(id: number) {
  return prisma.editeur.findUnique({
    where: { id },
    include: {
      documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
      logiciels: { select: { id: true, nom: true, statut: true }, orderBy: { nom: "asc" } },
    },
  });
}

/**
 * Éditeurs précédent et suivant dans l'ordre alphabétique de la liste.
 * Même approche que `voisinsLogiciel` : c'est la requête de la liste, donc les
 * deux ordres ne peuvent pas diverger, et les homonymes ne bloquent rien.
 */
export async function voisinsEditeur(id: number): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = (
    await prisma.editeur.findMany({
      orderBy: [{ nom: "asc" }, { id: "asc" }],
      select: { id: true, nom: true },
    })
  ).sort((a, b) => compareAlpha(a.nom, b.nom));
  const i = tous.findIndex((e) => e.id === id);
  if (i === -1) return { precedent: null, suivant: null };
  return { precedent: tous[i - 1] ?? null, suivant: tous[i + 1] ?? null };
}

export function createEditeur(data: EditeurInput) {
  return prisma.editeur.create({ data });
}

export function updateEditeur(id: number, data: EditeurInput) {
  return prisma.editeur.update({ where: { id }, data });
}

export function deleteEditeur(id: number) {
  return prisma.editeur.delete({ where: { id } });
}

/**
 * Pièces jointes de la fiche éditeur (garde-fou anti-orphelins : la cascade
 * efface les lignes `documents` sans retirer les fichiers du disque).
 *
 * Un seul chemin ici : les contrats qu'elle FOURNIT et les logiciels qu'elle
 * édite ne sont pas emportés par sa suppression — ces liens passent en SetNull.
 */
export function compterPiecesEditeur(id: number) {
  return prisma.document.count({ where: { editeurId: id } });
}
