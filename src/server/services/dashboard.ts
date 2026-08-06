import { dateCalendaire, estEnRetard, joursAvantEcheance } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { prisma } from "@/server/db";

// Agrégats du tableau de bord. Chaque chiffre renvoie vers l'écran où l'on
// AGIT dessus (principe des tuiles cliquables du style cparfait).

export type Repartition = Array<{ label: string; couleur: string; nb: number }>;

export type DonneesDashboard = {
  nbLogiciels: number;
  nbEnProduction: number;
  nbEditeurs: number;
  nbServeurs: number;
  coutAnnuelTotal: number;
  contratsDepasses: Array<{ id: number; nom: string }>;
  tachesEnRetard: Array<{
    id: number;
    logicielId: number;
    titre: string;
    logiciel: string;
    echeance: Date;
  }>;
  tachesSous30j: number;
  /** Horizon des renouvellements, en jours — le titre de la carte l'annonce. */
  seuilRenouvellementJours: number;
  /**
   * Deux origines, une seule forme : un marché (qui renvoie vers sa fiche et
   * cite les logiciels couverts) ou la date de fin portée par une fiche
   * logiciel (qui renvoie vers son onglet Contrats).
   */
  renouvellements: Array<{
    href: string;
    titre: string;
    detail: string;
    echeance: Date;
  }>;
  parHebergement: Repartition;
  parCriticite: Repartition;
};

const COULEURS_HEBERGEMENT: Record<string, string> = {
  saas: "#2563eb",
  on_premise: "#4f46e5",
  hybride: "#7c3aed",
};
const LIBELLES_HEBERGEMENT: Record<string, string> = {
  saas: "SaaS",
  on_premise: "On premise",
  hybride: "Hybride",
};

export async function chargerDashboard(): Promise<DonneesDashboard> {
  const aujourdhui = dateCalendaire(new Date());
  // Même horizon que les rappels par e-mail : la carte annonce la fenêtre que
  // le cron applique réellement (voir seuilsRappel).
  const { contrat: seuilJours } = await seuilsRappel();
  const fenetre = new Date(aujourdhui.getTime() + seuilJours * 86_400_000);

  const [
    logiciels,
    coutDesMarches,
    nbEditeurs,
    nbServeurs,
    criticites,
    taches,
    contratsARenouveler,
  ] = await Promise.all([
    prisma.logiciel.findMany({
      select: {
        id: true,
        nom: true,
        statut: true,
        hebergement: true,
        criticiteId: true,
        coutAnnuel: true,
        nbUtilisateurs: true,
        nbMaxUtilisateurs: true,
        finContratLe: true,
      },
    }),
    // Le coût vit sur le MARCHÉ, et se somme GLOBALEMENT, pas fiche par
    // fiche : un marché commun couvre plusieurs logiciels, le compter chez
    // chacun le compterait autant de fois. (Il vivait auparavant sur les
    // pièces, dont la colonne `cout_annuel` garde les valeurs historiques :
    // elles ne sont plus comptées, sans quoi un marché dont le montant a été
    // ressaisi le serait deux fois.)
    prisma.contrat.aggregate({ _sum: { montantAnnuel: true } }),
    prisma.editeur.count(),
    prisma.serveur.count(),
    prisma.criticite.findMany({ orderBy: { rank: "asc" } }),
    prisma.tacheRecurrente.findMany({
      where: { statut: "active" },
      select: {
        id: true,
        titre: true,
        prochaineEcheance: true,
        logiciel: { select: { id: true, nom: true } },
      },
    }),
    // Le MARCHÉ porte l'échéance ; ses pièces n'ont qu'une date de document.
    // Borne basse comme pour les rappels : un marché terminé n'est pas à
    // renouveler dans la fenêtre, il est de l'historique.
    prisma.contrat.findMany({
      where: { dateFin: { gte: aujourdhui, lte: fenetre } },
      select: {
        id: true,
        libelle: true,
        referenceMarche: true,
        dateFin: true,
        logiciels: { select: { logiciel: { select: { nom: true } } } },
      },
    }),
  ]);

  // Coût annuel total : coût des fiches + montant annuel des marchés, ces
  // derniers comptés une seule fois quel que soit le nombre de logiciels
  // couverts.
  let coutAnnuelTotal = Number(coutDesMarches._sum.montantAnnuel ?? 0);
  for (const l of logiciels) {
    if (l.coutAnnuel) coutAnnuelTotal += Number(l.coutAnnuel);
  }

  // Contrats dépassés (même règle que la liste/l'export).
  const contratsDepasses = logiciels
    .filter(
      (l) =>
        l.nbUtilisateurs !== null &&
        l.nbMaxUtilisateurs !== null &&
        l.nbUtilisateurs > l.nbMaxUtilisateurs,
    )
    .map((l) => ({ id: l.id, nom: l.nom }));

  const tachesEnRetard = taches
    .filter((t) => estEnRetard(t.prochaineEcheance, aujourdhui))
    .sort((a, b) => a.prochaineEcheance.getTime() - b.prochaineEcheance.getTime())
    .map((t) => ({
      id: t.id,
      logicielId: t.logiciel.id,
      titre: t.titre,
      logiciel: t.logiciel.nom,
      echeance: t.prochaineEcheance,
    }));

  const tachesSous30j = taches.filter(
    (t) =>
      !estEnRetard(t.prochaineEcheance, aujourdhui) &&
      joursAvantEcheance(t.prochaineEcheance, aujourdhui) <= 30,
  ).length;

  // Renouvellements à venir : marchés + fins de contrat des fiches. Le marché
  // renvoie vers SA fiche — il couvre parfois plusieurs logiciels, aucun ne
  // pouvant prétendre le représenter — et cite dessous ce qu'il couvre.
  const renouvellements = [
    ...contratsARenouveler.map((c) => ({
      href: `/contrats/${c.id}`,
      // Le libellé suffit quand il est là ; le préfixer donnerait « Contrat
      // Contrat VIP Adobe » pour les libellés qui disent déjà « contrat ».
      titre: c.libelle || (c.referenceMarche ? `Contrat ${c.referenceMarche}` : "Contrat"),
      detail: c.logiciels.map((l) => l.logiciel.nom).join(", ") || "Aucun logiciel rattaché",
      echeance: c.dateFin as Date,
    })),
    ...logiciels
      // Même règle que pour les marchés : une fin de contrat déjà passée est de
      // l'historique, pas un renouvellement à venir.
      .filter(
        (l) =>
          l.finContratLe &&
          l.finContratLe.getTime() >= aujourdhui.getTime() &&
          l.finContratLe.getTime() <= fenetre.getTime(),
      )
      .map((l) => ({
        href: `/logiciels/${l.id}?onglet=contrats`,
        titre: l.nom,
        detail: "Fin de contrat / marché",
        echeance: l.finContratLe as Date,
      })),
  ].sort((a, b) => a.echeance.getTime() - b.echeance.getTime());

  const parHebergement: Repartition = (["saas", "on_premise", "hybride"] as const)
    .map((h) => ({
      label: LIBELLES_HEBERGEMENT[h],
      couleur: COULEURS_HEBERGEMENT[h],
      nb: logiciels.filter((l) => l.hebergement === h).length,
    }))
    .filter((r) => r.nb > 0);

  const nonEvalues = logiciels.filter((l) => l.criticiteId === null).length;
  const parCriticite: Repartition = [
    ...criticites
      .map((c) => ({
        label: c.label,
        couleur: c.couleur || "#94a3b8",
        nb: logiciels.filter((l) => l.criticiteId === c.id).length,
      }))
      .filter((r) => r.nb > 0),
    ...(nonEvalues > 0 ? [{ label: "Non évaluée", couleur: "#94a3b8", nb: nonEvalues }] : []),
  ];

  return {
    nbLogiciels: logiciels.length,
    nbEnProduction: logiciels.filter((l) => l.statut === "production").length,
    nbEditeurs,
    nbServeurs,
    coutAnnuelTotal,
    contratsDepasses,
    tachesEnRetard,
    tachesSous30j,
    seuilRenouvellementJours: seuilJours,
    renouvellements,
    parHebergement,
    parCriticite,
  };
}
