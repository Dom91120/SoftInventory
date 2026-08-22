import type { CategorieEditeur } from "@/generated/prisma/client";
import { compareAlpha } from "@/lib/format";
import type { EditeurInput } from "@/schemas/editeur";
import { prisma } from "@/server/db";

/**
 * L'annuaire, éventuellement filtré par une recherche libre et une catégorie.
 * `q` porte sur ce que la liste MONTRE — nom, site web, contact commercial —
 * plutôt que sur le nom seul : on cherche aussi bien « Dupont » qu'« Arpège ».
 * La ville reste cherchable bien que sa colonne ait cédé la place au
 * commercial : elle est toujours sur la fiche, et « Rennes » trouvait ses
 * éditeurs jusqu'ici.
 *
 * Sans filtre (le cas de tous les autres appelants : listes déroulantes de
 * fournisseurs, formulaires), le comportement est inchangé.
 */
export async function listEditeurs(filtres: { q?: string; categorie?: CategorieEditeur } = {}) {
  const q = filtres.q?.trim();
  const editeurs = await prisma.editeur.findMany({
    where: {
      ...(filtres.categorie ? { categorie: filtres.categorie } : {}),
      ...(q
        ? {
            OR: [
              { nom: { contains: q, mode: "insensitive" } },
              { ville: { contains: q, mode: "insensitive" } },
              { siteWeb: { contains: q, mode: "insensitive" } },
              { commercialContact: { contains: q, mode: "insensitive" } },
              { commercialEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ nom: "asc" }, { id: "asc" }],
  });
  return editeurs.sort((a, b) => compareAlpha(a.nom, b.nom));
}

export function getEditeur(id: number) {
  return prisma.editeur.findUnique({
    where: { id },
    include: {
      documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } },
      logiciels: { select: { id: true, nom: true, statut: true }, orderBy: { nom: "asc" } },
      // Les logiciels qu'elle nous VEND sans les faire : par les marchés dont
      // elle est le fournisseur, et par les devis qu'elle a remis. La fiche
      // les regroupe (logicielsFournisPar) — un revendeur n'a aucun logiciel
      // « à lui » et sa fiche restait vide.
      contratsFournis: {
        select: { logiciels: { select: { logiciel: { select: { id: true, nom: true } } } } },
      },
      devisRemis: {
        select: { consultation: { select: { logiciel: { select: { id: true, nom: true } } } } },
      },
    },
  });
}

export type LogicielFourni = {
  id: number;
  nom: string;
  /** Par quelle(s) voie(s) la société fournit ce logiciel. */
  voies: Array<"marche" | "devis">;
};

/**
 * Les logiciels qu'une société FOURNIT SANS LES FAIRE, chacun une fois, avec
 * la ou les voies qui l'y relient. Ceux qu'elle édite sont écartés : ils sont
 * déjà dans « Logiciels de cet éditeur », et les relire en dessous n'apprend
 * rien. Pure : travaille sur ce que getEditeur a chargé.
 */
export function logicielsFournisPar(
  editeur: NonNullable<Awaited<ReturnType<typeof getEditeur>>>,
): LogicielFourni[] {
  const edites = new Set(editeur.logiciels.map((l) => l.id));
  const parId = new Map<number, LogicielFourni>();
  const ajouter = (l: { id: number; nom: string }, voie: "marche" | "devis") => {
    if (edites.has(l.id)) return;
    const entree = parId.get(l.id) ?? { id: l.id, nom: l.nom, voies: [] };
    if (!entree.voies.includes(voie)) entree.voies.push(voie);
    parId.set(l.id, entree);
  };
  for (const c of editeur.contratsFournis)
    for (const { logiciel } of c.logiciels) ajouter(logiciel, "marche");
  for (const d of editeur.devisRemis) ajouter(d.consultation.logiciel, "devis");
  return [...parId.values()].sort((a, b) => compareAlpha(a.nom, b.nom));
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
