import { dateCalendaire } from "@/lib/taches-core";
import { LIBELLES } from "@/schemas/logiciel";
import { prisma } from "@/server/db";

/**
 * Agrégats de l'écran Statistiques. Tout est calculé ICI, en une passe : la
 * page reste un composant serveur et n'embarque aucune bibliothèque de
 * graphiques — des div, des pourcentages, et les couleurs des référentiels.
 *
 * Ce qui a guidé le choix des séries, en regardant les données réelles plutôt
 * qu'un catalogue de graphiques :
 *
 *  - certains champs ne sont qu'à leur VALEUR PAR DÉFAUT (82 logiciels sur 85
 *    en localisation de données « inconnue ») : en faire un graphique décrirait
 *    le formulaire, pas le parc. Ils sont écartés des répartitions, et comptés
 *    dans la complétude — c'est ce qu'est devenue l'authentification, qui n'a
 *    plus de défaut du tout depuis qu'elle disait « locale » de 84 fiches sur
 *    85 sans que personne l'ait saisi ;
 *  - à l'inverse, ce qui EST renseigné se prête à la comparaison : hébergement,
 *    éditeurs, services, technologies ;
 *  - l'inventaire étant jeune, la part de fiches renseignées est en soi la
 *    statistique la plus utile — elle dit où porter l'effort de saisie.
 */

/** Une série à barres : un libellé, un nombre, et une couleur si le référentiel en donne une. */
export type Serie = Array<{ label: string; nb: number; couleur?: string }>;

export type DonneesStatistiques = {
  nbLogiciels: number;
  /** Répartitions du parc — seulement les champs réellement renseignés. */
  parHebergement: Serie;
  parStatut: Serie;
  parCriticite: Serie;
  parTechnologie: Serie;
  parSource: Serie;
  /** Classements : une seule couleur, c'est la longueur qui parle. */
  topEditeurs: Serie;
  topServices: Serie;
  topServeurs: Serie;
  /** Ce que pèse chaque fournisseur dans le coût annuel du parc. */
  coutParFournisseur: Serie;
  coutTotal: number;
  nbMarchesChiffres: number;
  nbMarches: number;
  /** Douze mois d'échéances à venir, contrats et certificats confondus. */
  echeances: Array<{ mois: string; contrats: number; certificats: number }>;
  /** Part des fiches logiciel qui portent l'information. */
  completude: Array<{ label: string; renseignes: number; total: number }>;
};

/** Trie décroissant et ne garde que les premiers — le reste ferait du bruit. */
function top(serie: Serie, n: number): Serie {
  return [...serie].sort((a, b) => b.nb - a.nb).slice(0, n);
}

export async function chargerStatistiques(): Promise<DonneesStatistiques> {
  const aujourdhui = dateCalendaire(new Date());
  // Douze mois pleins à partir du mois courant : au-delà, les échéances sont
  // trop lointaines pour appeler une action, et la colonne serait vide.
  const finFenetre = new Date(
    Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth() + 12, 1),
  );
  const debutMois = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), 1));

  const [logiciels, statuts, hebergements, criticites, contrats, certificats, marches] =
    await Promise.all([
      prisma.logiciel.findMany({
        select: {
          id: true,
          statut: true,
          hebergement: true,
          typeSource: true,
          criticiteId: true,
          technologieId: true,
          editeurId: true,
          developpementInterne: true,
          dateMiseEnService: true,
          authentification: true,
          referentMetier: true,
          donneesPersonnelles: true,
          registreRef: true,
          editeur: { select: { nom: true } },
          technologie: { select: { label: true } },
          services: { select: { service: { select: { nom: true } } } },
          serveurs: { select: { serveur: { select: { nom: true } } } },
          contrats: { select: { contratId: true } },
        },
      }),
      prisma.statutLogiciel.findMany({ orderBy: { position: "asc" } }),
      prisma.modeHebergement.findMany({ orderBy: { position: "asc" } }),
      prisma.criticite.findMany({ orderBy: { rank: "asc" } }),
      // Les marchés chiffrés, pour le coût par fournisseur.
      prisma.contrat.findMany({
        where: { montantAnnuel: { not: null } },
        select: { montantAnnuel: true, fournisseur: { select: { nom: true } } },
      }),
      prisma.certificat.findMany({
        where: { dateFin: { gte: debutMois, lt: finFenetre }, statut: { not: "revoque" } },
        select: { dateFin: true },
      }),
      prisma.contrat.findMany({
        where: { dateFin: { gte: debutMois, lt: finFenetre } },
        select: { dateFin: true },
      }),
    ]);

  const total = logiciels.length;

  /** Compte les occurrences d'une clé, en gardant l'ordre du référentiel. */
  const parReferentiel = <T extends string>(
    lignes: Array<{ cle: T; label: string; couleur: string }>,
    valeur: (l: (typeof logiciels)[number]) => T,
  ): Serie =>
    lignes
      .map((r) => ({
        label: r.label,
        couleur: r.couleur || undefined,
        nb: logiciels.filter((l) => valeur(l) === r.cle).length,
      }))
      .filter((r) => r.nb > 0);

  const parStatut = parReferentiel(statuts, (l) => l.statut);
  const parHebergement = parReferentiel(hebergements, (l) => l.hebergement);

  // La criticité garde son ordre de gravité, et le « non évalué » ferme la
  // marche : c'est une absence de réponse, pas un degré de plus.
  const nonEvalues = logiciels.filter((l) => l.criticiteId === null).length;
  const parCriticite: Serie = [
    ...criticites
      .map((c) => ({
        label: c.label,
        couleur: c.couleur || undefined,
        nb: logiciels.filter((l) => l.criticiteId === c.id).length,
      }))
      .filter((r) => r.nb > 0),
    ...(nonEvalues > 0 ? [{ label: "Non évaluée", couleur: "#94a3b8", nb: nonEvalues }] : []),
  ];

  const parSource: Serie = (["proprietaire", "opensource", "mixte"] as const)
    .map((cle) => ({
      label: LIBELLES.typeSource[cle],
      nb: logiciels.filter((l) => l.typeSource === cle).length,
    }))
    .filter((r) => r.nb > 0);

  /** Comptage libre par libellé, pour les classements. */
  const compter = (libelles: string[]): Serie => {
    const par = new Map<string, number>();
    for (const nom of libelles) par.set(nom, (par.get(nom) ?? 0) + 1);
    return [...par].map(([label, nb]) => ({ label, nb }));
  };

  const parTechnologie = top(
    compter(logiciels.map((l) => l.technologie?.label ?? "").filter(Boolean)),
    8,
  );
  const topEditeurs = top(
    compter(
      logiciels
        .filter((l) => l.editeur)
        .map((l) => l.editeur?.nom ?? "")
        .filter(Boolean),
    ),
    10,
  );
  const topServices = top(
    compter(logiciels.flatMap((l) => l.services.map((s) => s.service.nom))),
    10,
  );
  const topServeurs = top(
    compter(logiciels.flatMap((l) => l.serveurs.map((s) => s.serveur.nom))),
    10,
  );

  // Le coût par fournisseur : ce que chaque société pèse dans la dépense
  // annuelle. Les marchés sans fournisseur renseigné sont regroupés, plutôt
  // qu'écartés — les ignorer ferait mentir le total affiché à côté.
  const coutPar = new Map<string, number>();
  let coutTotal = 0;
  for (const c of contrats) {
    const montant = Number(c.montantAnnuel ?? 0);
    coutTotal += montant;
    const nom = c.fournisseur?.nom ?? "Sans fournisseur";
    coutPar.set(nom, (coutPar.get(nom) ?? 0) + montant);
  }
  const coutParFournisseur = top(
    [...coutPar].map(([label, nb]) => ({ label, nb })),
    10,
  );

  // Douze colonnes, y compris les mois vides : un calendrier troué se lit mal,
  // et l'absence d'échéance est elle-même une information.
  const fmtMois = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
  const echeances = Array.from({ length: 12 }, (_, i) => {
    const debut = new Date(Date.UTC(debutMois.getUTCFullYear(), debutMois.getUTCMonth() + i, 1));
    const fin = new Date(Date.UTC(debutMois.getUTCFullYear(), debutMois.getUTCMonth() + i + 1, 1));
    const dans = (d: Date | null) => d !== null && d >= debut && d < fin;
    return {
      mois: fmtMois.format(debut).replace(".", ""),
      contrats: marches.filter((m) => dans(m.dateFin)).length,
      certificats: certificats.filter((c) => dans(c.dateFin)).length,
    };
  });

  // Complétude : ce que l'inventaire sait déjà de chaque fiche. L'ordre va du
  // mieux rempli au moins rempli — la lecture commence par ce qui va bien et
  // descend vers ce qui reste à faire.
  const completude = [
    {
      label: "Service utilisateur",
      renseignes: logiciels.filter((l) => l.services.length > 0).length,
    },
    // « Développement interne » RÉPOND à la question « qui l'édite ? » : la
    // fiche est renseignée, même si aucune ligne de l'annuaire n'est désignée.
    // La sentinelle de la liste ne vit que dans l'écran — en base, c'est le
    // booléen qui la porte —, et ne compter que `editeurId` reprochait à cinq
    // fiches faites maison un champ qu'elles avaient bel et bien rempli.
    {
      label: "Éditeur",
      renseignes: logiciels.filter((l) => l.editeurId !== null || l.developpementInterne).length,
    },
    { label: "Technologie", renseignes: logiciels.filter((l) => l.technologieId !== null).length },
    { label: "Marché rattaché", renseignes: logiciels.filter((l) => l.contrats.length > 0).length },
    { label: "Serveur", renseignes: logiciels.filter((l) => l.serveurs.length > 0).length },
    { label: "Criticité", renseignes: logiciels.filter((l) => l.criticiteId !== null).length },
    {
      label: "Référent métier",
      renseignes: logiciels.filter((l) => l.referentMetier !== "").length,
    },
    {
      label: "Date de mise en service",
      renseignes: logiciels.filter((l) => l.dateMiseEnService !== null).length,
    },
    // Le champ a rejoint cette liste le jour où il a cessé d'avoir une valeur
    // par défaut : tant que « locale » s'écrivait tout seul, il se disait
    // rempli à 100 % sans que personne l'ait saisi.
    {
      label: "Authentification",
      renseignes: logiciels.filter((l) => l.authentification !== null).length,
    },
  ]
    .map((c) => ({ ...c, total }))
    .sort((a, b) => b.renseignes - a.renseignes);

  return {
    nbLogiciels: total,
    parHebergement,
    parStatut,
    parCriticite,
    parTechnologie,
    parSource,
    topEditeurs,
    topServices,
    topServeurs,
    coutParFournisseur,
    coutTotal,
    nbMarchesChiffres: contrats.length,
    nbMarches: await prisma.contrat.count(),
    echeances,
    completude,
  };
}
