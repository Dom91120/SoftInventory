import { compareAlpha } from "@/lib/format";
import type { ContratInput } from "@/schemas/logiciel";
import { prisma } from "@/server/db";

/**
 * Marchés et contrats, vus pour eux-mêmes — l'écran transversal, par opposition
 * à l'onglet d'une fiche logiciel qui n'en montre qu'une part.
 *
 * Un marché couvre N logiciels (UGAP, marchés « communs ») : c'est la table de
 * liaison `contrats_logiciels` qui porte le rattachement, et le marché survit à
 * la suppression des logiciels qu'il couvrait.
 */

/** Les marchés du plus récent au plus ancien — voir `ordonner`. */
export async function listContrats() {
  const contrats = await prisma.contrat.findMany({
    include: {
      fournisseur: { select: { id: true, nom: true } },
      logiciels: { select: { logiciel: { select: { id: true, nom: true } } } },
      _count: { select: { pieces: true } },
    },
  });
  return ordonner(contrats);
}

export function getContratComplet(id: number) {
  return prisma.contrat.findUnique({
    where: { id },
    include: {
      fournisseur: { select: { id: true, nom: true } },
      logiciels: {
        select: { logiciel: { select: { id: true, nom: true, statut: true } } },
      },
      pieces: {
        orderBy: [{ datePiece: "asc" }, { id: "asc" }],
        include: { documents: { include: { categorie: true }, orderBy: { createdAt: "desc" } } },
      },
    },
  });
}

/**
 * Rang d'un marché dans la liste : la date de DÉBUT d'abord — celle à laquelle
 * il a pris effet —, la date de fin ensuite pour ceux qui n'ont que celle-là,
 * l'id en dernier ressort. Les marchés sans aucune date ferment la marche
 * plutôt que de l'ouvrir : trié en base, l'ordre décroissant de PostgreSQL les
 * remonterait en tête.
 */
function ordonner<T extends { dateDebut: Date | null; dateFin: Date | null; id: number }>(
  contrats: T[],
): T[] {
  const rang = (d: Date | null) => (d === null ? Number.NEGATIVE_INFINITY : d.getTime());
  return contrats.sort(
    (a, b) =>
      rang(b.dateDebut) - rang(a.dateDebut) || rang(b.dateFin) - rang(a.dateFin) || b.id - a.id,
  );
}

/**
 * Marchés précédent et suivant, dans l'ordre de la liste — mêmes flèches que
 * sur les fiches logiciel et éditeur. C'est la requête de la liste qui sert de
 * référence, les deux ordres ne peuvent donc pas diverger.
 */
export async function voisinsContrat(id: number): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = ordonner(
    await prisma.contrat.findMany({
      select: { id: true, libelle: true, referenceMarche: true, dateDebut: true, dateFin: true },
    }),
  ).map((c) => ({ id: c.id, nom: nomDe(c) }));
  const i = tous.findIndex((c) => c.id === id);
  if (i === -1) return { precedent: null, suivant: null };
  return { precedent: tous[i - 1] ?? null, suivant: tous[i + 1] ?? null };
}

/**
 * Nom d'usage d'un marché : sa référence si elle existe, son libellé sinon.
 * Aucun des deux n'est obligatoire — d'où le repli final, qui vaut mieux qu'une
 * ligne vide dans une liste.
 */
export function nomDe(c: { libelle: string; referenceMarche: string }): string {
  return c.referenceMarche || c.libelle || "sans référence";
}

/** Crée le marché et pose ses rattachements. */
export function createContratAvecLogiciels(data: ContratInput, logicielIds: number[]) {
  return prisma.contrat.create({
    data: {
      ...data,
      logiciels: { create: logicielIds.map((logicielId) => ({ logicielId })) },
    },
  });
}

/**
 * Met à jour le marché ET la liste des logiciels couverts, en une transaction :
 * un rattachement retiré ne doit pas survivre à l'échec de la mise à jour.
 *
 * Même règle que sur la fiche logiciel : une nouvelle date de fin rouvre le
 * rappel (`rappelEnvoyeLe` remis à null), mais seulement si elle a changé.
 */
export function updateContratAvecLogiciels(id: number, data: ContratInput, logicielIds: number[]) {
  return prisma.$transaction(async (tx) => {
    const avant = await tx.contrat.findUnique({ where: { id }, select: { dateFin: true } });
    const dateChangee = avant?.dateFin?.getTime() !== data.dateFin?.getTime();
    await tx.contratLogiciel.deleteMany({
      where: { contratId: id, logicielId: { notIn: logicielIds } },
    });
    for (const logicielId of logicielIds) {
      await tx.contratLogiciel.upsert({
        where: { contratId_logicielId: { contratId: id, logicielId } },
        update: {},
        create: { contratId: id, logicielId },
      });
    }
    return tx.contrat.update({
      where: { id },
      data: { ...data, ...(dateChangee ? { rappelEnvoyeLe: null } : {}) },
    });
  });
}

/**
 * Écrans qu'une modification du marché périme : sa fiche, la liste, et l'onglet
 * Contrats/Marchés de CHAQUE logiciel couvert — un marché commun se lit depuis
 * plusieurs fiches, les rafraîchir toutes est le seul moyen qu'aucune n'affiche
 * un montant périmé.
 *
 * À appeler AVANT une suppression : après, les rattachements n'existent plus et
 * les fiches logiciel resteraient sur leur ancien affichage.
 */
export async function cheminsDuContrat(contratId: number): Promise<string[]> {
  const liens = await prisma.contratLogiciel.findMany({
    where: { contratId },
    select: { logicielId: true },
  });
  return ["/contrats", `/contrats/${contratId}`, ...liens.map((l) => `/logiciels/${l.logicielId}`)];
}

/** Logiciels de l'inventaire, pour la liste de rattachement de la fiche. */
export async function listLogicielsPourRattachement() {
  const logiciels = await prisma.logiciel.findMany({ select: { id: true, nom: true } });
  return logiciels.sort((a, b) => compareAlpha(a.nom, b.nom));
}
