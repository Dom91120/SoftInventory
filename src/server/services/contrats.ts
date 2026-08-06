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

/**
 * Titre de la FICHE : le libellé, ce que le marché EST — « Maintenance SOPRANO
 * MOBILITE OPUS ». Sa référence se lit juste en dessous, elle n'a pas à être
 * répétée en gros. Repli sur elle quand le libellé manque : un en-tête vide ne
 * dirait rien. C'est l'inverse de `nomDe`, qui identifie en une ligne de liste.
 */
export function titreDe(c: { libelle: string; referenceMarche: string }): string {
  return c.libelle || c.referenceMarche || "sans référence";
}

/**
 * État d'un marché à une date donnée. Trois cas EXCLUSIFS : son terme est
 * passé, il approche (dans la fenêtre de rappel), ou le marché court.
 *
 * Calculé et non stocké : un état enregistré se désynchroniserait de la date le
 * lendemain de l'échéance. `limite` vient du délai de rappel administrable, si
 * bien que la pastille et l'e-mail se déclenchent au même moment.
 *
 * Sans date de fin, le marché court : c'est le cas des contrats à tacite
 * reconduction, qu'aucune échéance ne menace.
 */
export function etatMarche(
  dateFin: Date | null,
  aujourdhui: Date,
  limite: Date,
): "termine" | "a_renouveler" | "en_cours" {
  if (dateFin === null) return "en_cours";
  if (dateFin < aujourdhui) return "termine";
  return dateFin <= limite ? "a_renouveler" : "en_cours";
}

/** Crée le marché. Ses rattachements se posent ensuite, un par un. */
export function createContrat(data: ContratInput) {
  return prisma.contrat.create({ data });
}

/**
 * Rattachements : un geste chacun, appliqué aussitôt — comme les serveurs de
 * l'onglet Liaisons, et non comme un champ qu'il faudrait enregistrer.
 *
 * `upsert` plutôt que `create` : rattacher deux fois le même logiciel est sans
 * effet plutôt qu'une erreur de clé, ce qui rend l'action rejouable (double
 * clic, retour arrière).
 */
export function attacherLogiciel(contratId: number, logicielId: number) {
  return prisma.contratLogiciel.upsert({
    where: { contratId_logicielId: { contratId, logicielId } },
    update: {},
    create: { contratId, logicielId },
  });
}

/** Détache SANS rien supprimer d'autre : le marché reste, le logiciel aussi. */
export function detacherLogiciel(contratId: number, logicielId: number) {
  return prisma.contratLogiciel.deleteMany({ where: { contratId, logicielId } });
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
