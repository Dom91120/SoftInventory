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

/** Filtres de la liste des marchés, tous facultatifs et cumulatifs. */
export type FiltresContrats = { q?: string; fournisseurId?: number };

/**
 * Les marchés du plus récent au plus ancien — voir `ordonner`.
 *
 * `q` porte sur la référence ET le libellé : dans cette liste on cherche
 * indifféremment « CT2406 » ou « urbanisme ». Les logiciels couverts n'y sont
 * pas cherchés — c'est le rôle de la fiche du logiciel, où l'on part de lui.
 */
export async function listContrats(filtres: FiltresContrats = {}) {
  const q = filtres.q?.trim();
  const contrats = await prisma.contrat.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { referenceMarche: { contains: q, mode: "insensitive" } },
              { libelle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filtres.fournisseurId ? { fournisseurId: filtres.fournisseurId } : {}),
    },
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

// ── Tri de la liste, au clic sur une colonne ────────────────────────────────
// Vit ici et non près de l'écran : la liste, l'export CSV et les flèches d'une
// fiche s'en servent, et un ordre qui diffère entre eux se remarquerait aussitôt.

/** Les six colonnes de la liste, dans leur ordre d'affichage. */
export const TRIS_CONTRATS = [
  "marche",
  "fournisseur",
  "logiciels",
  "periode",
  "montant",
  "etat",
] as const;
export type TriContrat = (typeof TRIS_CONTRATS)[number];
export type SensTri = "asc" | "desc";

/**
 * Sens PROPOSÉ au premier clic sur une colonne, celui qui répond à la question
 * qu'on se pose en la cliquant. Un texte se parcourt de A à Z ; une date ou un
 * montant, on veut d'abord le plus récent et le plus gros ; un état, ce qui
 * réclame une action.
 */
export const SENS_PAR_DEFAUT: Record<TriContrat, SensTri> = {
  marche: "asc",
  fournisseur: "asc",
  logiciels: "asc",
  periode: "desc",
  montant: "desc",
  etat: "asc",
};

/** Ce dont on dispose pour trier : ce que la liste affiche, et rien de plus. */
type LigneTriable = {
  id: number;
  libelle: string;
  referenceMarche: string;
  dateDebut: Date | null;
  dateFin: Date | null;
  montantAnnuel: unknown;
  fournisseur: { nom: string } | null;
  logiciels: Array<{ logiciel: { nom: string } }>;
};

/**
 * Rang de l'état : ce qui RÉCLAME une action vient en tête. « À renouveler »
 * est le seul des trois sur lequel on peut agir aujourd'hui.
 */
const RANG_ETAT = { a_renouveler: 0, en_cours: 1, termine: 2 } as const;

/**
 * La valeur sur laquelle une colonne se trie — `null` quand la ligne n'en a
 * pas. La colonne PÉRIODE se trie toujours sur la date de DÉBUT : c'est celle
 * à laquelle le marché a pris effet, et la seule des deux que toutes les
 * lignes portent au même titre.
 */
function valeurDeTri(
  c: LigneTriable,
  tri: TriContrat,
  jour: Date,
  limite: Date,
): string | number | null {
  switch (tri) {
    case "marche":
      return titreDe(c);
    case "fournisseur":
      return c.fournisseur?.nom ?? null;
    case "logiciels":
      return c.logiciels.length === 0 ? null : c.logiciels.map((l) => l.logiciel.nom).join(" · ");
    case "periode":
      return c.dateDebut?.getTime() ?? null;
    case "montant":
      return c.montantAnnuel === null || c.montantAnnuel === undefined
        ? null
        : Number(c.montantAnnuel);
    case "etat":
      return RANG_ETAT[etatMarche(c.dateFin, jour, limite)];
  }
}

/**
 * Tri de la liste, appliqué en mémoire — les marchés y tiennent, et l'état
 * comme le titre se calculent plutôt qu'ils ne se lisent en base : PostgreSQL
 * ne saurait pas les ordonner.
 *
 * Les lignes SANS valeur ferment la marche dans les deux sens. Un marché sans
 * fournisseur n'est ni « avant A » ni « après Z » : il n'a rien à dire sur ce
 * critère, et le remonter en tête d'un tri décroissant cacherait ce qu'on
 * cherchait. L'id départage à égalité, pour que deux rangs identiques ne
 * s'échangent pas d'un affichage à l'autre.
 */
export function trierContrats<T extends LigneTriable>(
  contrats: T[],
  tri: TriContrat,
  sens: SensTri,
  jour: Date,
  limite: Date,
): T[] {
  const signe = sens === "asc" ? 1 : -1;
  return [...contrats].sort((a, b) => {
    const va = valeurDeTri(a, tri, jour, limite);
    const vb = valeurDeTri(b, tri, jour, limite);
    if (va === null || vb === null) {
      if (va !== null) return -1;
      if (vb !== null) return 1;
      return b.id - a.id;
    }
    const ecart = typeof va === "string" ? compareAlpha(va, vb as string) : va - (vb as number);
    return ecart * signe || b.id - a.id;
  });
}

/**
 * Marchés précédent et suivant, dans l'ordre de la liste — mêmes flèches que
 * sur les fiches logiciel et éditeur. L'ordre lui est TRANSMIS depuis l'écran
 * dont on vient : les deux ne peuvent donc pas diverger, y compris quand une
 * colonne a été triée au clic.
 *
 * Les filtres de la liste, eux, ne s'appliquent pas : les flèches parcourent
 * tous les marchés. Une fiche atteinte par un lien collé n'a pas de filtre à
 * hériter, et s'arrêter au bord d'une recherche surprendrait plus que ça
 * n'aiderait.
 */
export async function voisinsContrat(
  id: number,
  tri: TriContrat,
  sens: SensTri,
  jour: Date,
  limite: Date,
): Promise<{
  precedent: { id: number; nom: string } | null;
  suivant: { id: number; nom: string } | null;
}> {
  const tous = trierContrats(
    await prisma.contrat.findMany({
      select: {
        id: true,
        libelle: true,
        referenceMarche: true,
        dateDebut: true,
        dateFin: true,
        montantAnnuel: true,
        fournisseur: { select: { nom: true } },
        logiciels: { select: { logiciel: { select: { nom: true } } } },
      },
    }),
    tri,
    sens,
    jour,
    limite,
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

/**
 * Marchés proposés au rattachement dans l'onglet d'un logiciel. Deux familles,
 * et deux seulement — un menu qui déroulerait tout l'inventaire ne servirait à
 * personne :
 *
 *  - les ORPHELINS, qu'aucun logiciel ne couvre : saisis d'avance, ou détachés.
 *    On les RÉCUPÈRE plutôt que de les ressaisir ;
 *  - ceux du MÊME ÉDITEUR que le logiciel. C'est de ce côté que se trouvent les
 *    marchés à étendre : un éditeur signe un acte qui couvre plusieurs de ses
 *    applications, et on rattache la seconde depuis sa fiche.
 *
 * Un marché sans fournisseur nommé appartient à l'éditeur des logiciels qu'il
 * couvre — c'est ainsi que l'écran l'affiche (`fournisseurNom ?? editeurDuLogiciel`),
 * et la seconde famille le retient à ce titre. Sans quoi les marchés saisis
 * depuis une fiche, qui ne nomment presque jamais leur fournisseur, seraient
 * les grands absents de la liste.
 *
 * Les marchés que ce logiciel couvre DÉJÀ sont exclus : ils sont sous les yeux,
 * juste au-dessus du menu.
 *
 * Étiquetés « référence — libellé » : dans un menu déroulant c'est la référence
 * qui identifie ; plusieurs marchés partagent le même libellé (« Marché UGAP »),
 * aucun ne partage sa référence.
 */
export async function listMarchesPourRattachement(
  logicielId: number,
  editeurId: number | null,
): Promise<Array<{ id: number; nom: string }>> {
  const contrats = await prisma.contrat.findMany({
    where: {
      logiciels: { none: { logicielId } },
      OR: [
        { logiciels: { none: {} } },
        // Un logiciel sans éditeur — développement interne — n'a pas de famille
        // à proposer : il ne lui reste que les orphelins.
        ...(editeurId === null
          ? []
          : [
              { fournisseurId: editeurId },
              { fournisseurId: null, logiciels: { some: { logiciel: { editeurId } } } },
            ]),
      ],
    },
    select: { id: true, libelle: true, referenceMarche: true, dateDebut: true, dateFin: true },
  });
  return ordonner(contrats).map((c) => ({
    id: c.id,
    nom: [c.referenceMarche, c.libelle].filter(Boolean).join(" — ") || "sans référence",
  }));
}

/** Logiciels de l'inventaire, pour la liste de rattachement de la fiche. */
export async function listLogicielsPourRattachement() {
  const logiciels = await prisma.logiciel.findMany({ select: { id: true, nom: true } });
  return logiciels.sort((a, b) => compareAlpha(a.nom, b.nom));
}
