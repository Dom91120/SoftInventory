import { dateCalendaire, estEnRetard } from "@/lib/taches-core";
import { nomTitulaire } from "@/schemas/certificat";
import { seuilsRappel } from "@/server/config";
import { prisma } from "@/server/db";

// Agrégats du tableau de bord. Chaque chiffre renvoie vers l'écran où l'on
// AGIT dessus (principe des tuiles cliquables du style cparfait).

export type Repartition = Array<{ label: string; couleur: string; nb: number }>;

export type DonneesDashboard = {
  nbLogiciels: number;
  nbEnProduction: number;
  nbEditeurs: number;
  /** Dont, parmi eux : les autorités de certification, seule exception à la
   *  catégorie « éditeur/fournisseur » de l'annuaire. À zéro, la tuile se tait. */
  nbAutorites: number;
  /** Marchés et contrats, tous confondus — l'engagement en cours comme le passé. */
  nbContrats: number;
  nbServeurs: number;
  /** Certificats non révoqués : ce dont la collectivité dispose. */
  nbCertificats: number;
  coutAnnuelTotal: number;
  contratsDepasses: Array<{ id: number; nom: string }>;
  tachesEnRetard: Array<{
    id: number;
    logicielId: number;
    titre: string;
    logiciel: string;
    echeance: Date;
  }>;
  /**
   * Les tâches actives du parc, la plus proche d'abord — donc les retards
   * d'abord. Celles de TOUT LE MONDE, et non les seules du compte connecté :
   * l'écran décrit le parc, et une tâche en retard chez un collègue absent est
   * un problème pour tous. Chacune dit qui s'en charge.
   */
  taches: Array<{
    id: number;
    logicielId: number;
    logiciel: string;
    titre: string;
    assigne: string;
    echeance: Date;
    enRetard: boolean;
  }>;
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
  /** Horizon des certificats, en jours — son propre réglage, plus court. */
  seuilCertificatJours: number;
  /**
   * Les certificats à renouveler, le plus pressant d'abord. Les EXPIRÉS y
   * figurent aussi, en tête : un certificat périmé ne se constate pas, il se
   * remplace — et rien d'autre dans l'application ne le rappellerait, le cron
   * ayant cessé d'écrire une fois la date passée.
   */
  certificats: Array<{
    id: number;
    titulaire: string;
    detail: string;
    echeance: Date;
    expire: boolean;
  }>;
  parHebergement: Repartition;
  parCriticite: Repartition;
};

/**
 * L'écran est le MÊME pour tous : c'est un tableau de bord du parc, pas un
 * espace personnel. Il a un temps porté une carte « Mes tâches », filtrée sur
 * le compte connecté — d'où le paramètre `userId` que cette fonction prenait —
 * mais une tâche en retard chez un collègue absent est un problème pour tous,
 * et la carte les montre désormais toutes.
 */
/** Marché en cours au sens d'etatMarche : sans terme, ou dont le terme n'est
 *  pas passé. Sous forme de filtre Prisma, posé tel quel sur `contrat`. */
const MARCHE_EN_COURS = (aujourdhui: Date) => ({
  OR: [{ dateFin: null }, { dateFin: { gte: aujourdhui } }],
});

export async function chargerDashboard(): Promise<DonneesDashboard> {
  const aujourdhui = dateCalendaire(new Date());
  // Même horizon que les rappels par e-mail : la carte annonce la fenêtre que
  // le cron applique réellement (voir seuilsRappel).
  const { contrat: seuilJours, certificat: seuilCertificat } = await seuilsRappel();
  const fenetre = new Date(aujourdhui.getTime() + seuilJours * 86_400_000);
  const fenetreCertificat = new Date(aujourdhui.getTime() + seuilCertificat * 86_400_000);

  const [
    logiciels,
    coutDesMarches,
    logicielsAvecDevis,
    editeursParCategorie,
    nbContrats,
    nbServeurs,
    nbCertificats,
    criticites,
    modesHebergement,
    taches,
    contratsARenouveler,
    certificatsARenouveler,
  ] = await Promise.all([
    prisma.logiciel.findMany({
      select: {
        id: true,
        nom: true,
        statut: true,
        hebergement: true,
        criticiteId: true,
        nbUtilisateurs: true,
        nbMaxUtilisateurs: true,
      },
    }),
    // Le coût vit sur le MARCHÉ, et se somme GLOBALEMENT, pas fiche par
    // fiche : un marché commun couvre plusieurs logiciels, le compter chez
    // chacun le compterait autant de fois. (Il vivait auparavant sur les
    // pièces, dont la colonne `cout_annuel` garde les valeurs historiques :
    // elles ne sont plus comptées, sans quoi un marché dont le montant a été
    // ressaisi le serait deux fois.)
    //
    // Seuls les marchés EN COURS comptent — sans terme (tacite reconduction)
    // ou dont le terme n'est pas passé, même règle qu'etatMarche : un marché
    // terminé est de l'historique, pas une dépense.
    prisma.contrat.aggregate({
      where: { ...MARCHE_EN_COURS(aujourdhui) },
      _sum: { montantAnnuel: true },
    }),
    // Le DEVIS RETENU prend le relais là où aucun marché en cours chiffré ne
    // couvre le logiciel — qu'il n'ait pas de marché du tout ou que le sien
    // soit sans montant : c'est le chiffre qu'on a accepté, faute de mieux.
    // `contrats` ne ramène que les marchés en cours chiffrés : vide, le devis
    // compte. La consultation la plus récente qui ait un devis retenu.
    prisma.logiciel.findMany({
      where: { consultations: { some: { devis: { some: { retenu: true } } } } },
      select: {
        contrats: {
          where: { contrat: { ...MARCHE_EN_COURS(aujourdhui), montantAnnuel: { not: null } } },
          take: 1,
          select: { contratId: true },
        },
        consultations: {
          where: { devis: { some: { retenu: true } } },
          orderBy: [{ date: { sort: "desc", nulls: "last" } }, { id: "desc" }],
          take: 1,
          select: {
            devis: { where: { retenu: true }, take: 1, select: { montant: true } },
          },
        },
      },
    }),
    // Compté par catégorie : la tuile annonce le total et détaille les
    // exceptions — fournisseurs, autorités — quand il y en a.
    prisma.editeur.groupBy({ by: ["categorie"], _count: true }),
    prisma.contrat.count(),
    prisma.serveur.count(),
    // Les RÉVOQUÉS ne comptent pas : le parc, c'est ce dont on dispose, et un
    // certificat révoqué ne sert plus à rien même si sa date court encore.
    prisma.certificat.count({ where: { statut: { not: "revoque" } } }),
    prisma.criticite.findMany({ orderBy: { rank: "asc" } }),
    prisma.modeHebergement.findMany({ orderBy: { position: "asc" } }),
    // Juste de quoi nommer la tâche et la situer : les cartes du tableau de
    // bord n'affichent que ça, et le clic va lire le reste sur la fiche du
    // logiciel plutôt que de le faire voyager ici.
    prisma.tacheRecurrente.findMany({
      where: { statut: "active" },
      select: {
        id: true,
        titre: true,
        prochaineEcheance: true,
        assigneLibre: true,
        assigne: { select: { prenom: true, nom: true, email: true } },
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
    // PAS de borne basse ici, à la différence des marchés : un certificat
    // périmé reste à remplacer, et personne d'autre ne le dirait — le cron
    // cesse d'écrire une fois la date passée. Les révoqués sont hors du champ,
    // il n'y a rien à renouveler.
    prisma.certificat.findMany({
      where: { dateFin: { lte: fenetreCertificat }, statut: { not: "revoque" } },
      select: {
        id: true,
        civilite: true,
        titulaire: true,
        prenom: true,
        fonction: true,
        dateFin: true,
        fournisseur: { select: { nom: true } },
        service: { select: { nom: true } },
      },
    }),
  ]);

  // Coût annuel total : le montant annuel des MARCHÉS en cours, compté une
  // fois quel que soit le nombre de logiciels couverts, plus le devis retenu
  // des logiciels qu'aucun marché en cours chiffré ne couvre. La fiche
  // logiciel ne porte plus de coût propre — sa colonne garde des valeurs
  // historiques que rien ne met plus à jour, les compter fausserait le total.
  const coutDesDevis = logicielsAvecDevis
    .filter((l) => l.contrats.length === 0)
    .reduce((somme, l) => somme + Number(l.consultations[0]?.devis[0]?.montant ?? 0), 0);
  const coutAnnuelTotal = Number(coutDesMarches._sum.montantAnnuel ?? 0) + coutDesDevis;

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

  // TOUTES les tâches actives, et non les seules pressantes : la carte vaut
  // aussi pour ce qui vient dans six mois. La plus proche en tête, les retards
  // donc d'abord.
  //
  // L'assigné est DÉNORMALISÉ ici en une chaîne : un compte de l'application
  // (prénom + nom, à défaut l'adresse) ou le nom libre saisi pour quelqu'un qui
  // n'en a pas. La carte n'a qu'à l'afficher.
  const tachesAFaire = taches
    .sort((a, b) => a.prochaineEcheance.getTime() - b.prochaineEcheance.getTime())
    .map((t) => ({
      id: t.id,
      logicielId: t.logiciel.id,
      logiciel: t.logiciel.nom,
      titre: t.titre,
      assigne: t.assigne
        ? `${t.assigne.prenom} ${t.assigne.nom}`.trim() || t.assigne.email
        : t.assigneLibre,
      echeance: t.prochaineEcheance,
      enRetard: estEnRetard(t.prochaineEcheance, aujourdhui),
    }));

  // Renouvellements à venir : marchés + fins de contrat des fiches. Le marché
  // renvoie vers SA fiche — il couvre parfois plusieurs logiciels, aucun ne
  // pouvant prétendre le représenter — et cite dessous ce qu'il couvre.
  // Les MARCHÉS seuls : la fiche logiciel ne porte plus de date de fin, c'est
  // le marché rattaché qui tient l'échéance.
  const renouvellements = contratsARenouveler
    .map((c) => ({
      href: `/contrats/${c.id}`,
      // Le libellé suffit quand il est là ; le préfixer donnerait « Contrat
      // Contrat VIP Adobe » pour les libellés qui disent déjà « contrat ».
      titre: c.libelle || (c.referenceMarche ? `Contrat ${c.referenceMarche}` : "Contrat"),
      detail: c.logiciels.map((l) => l.logiciel.nom).join(", ") || "Aucun logiciel rattaché",
      echeance: c.dateFin as Date,
    }))
    .sort((a, b) => a.echeance.getTime() - b.echeance.getTime());

  // Libellés, couleurs et ordre viennent du référentiel : la barre dit la même
  // chose que la liste des logiciels, et suit ce qui y est administré.
  const parHebergement: Repartition = modesHebergement
    .map((m) => ({
      label: m.label,
      couleur: m.couleur || "#94a3b8",
      nb: logiciels.filter((l) => l.hebergement === m.cle).length,
    }))
    .filter((r) => r.nb > 0);

  // Le plus pressant d'abord, expirés en tête puisque leur date est la plus
  // ancienne. Le détail dit à qui et chez qui : de quoi décider s'il faut
  // relancer aujourd'hui sans ouvrir la fiche.
  const certificats = certificatsARenouveler
    .filter((c) => c.dateFin !== null)
    .map((c) => ({
      id: c.id,
      titulaire: nomTitulaire(c),
      detail:
        [c.fonction || c.service?.nom, c.fournisseur?.nom].filter(Boolean).join(" · ") ||
        "Certificat électronique",
      echeance: c.dateFin as Date,
      expire: (c.dateFin as Date).getTime() < aujourdhui.getTime(),
    }))
    .sort((a, b) => a.echeance.getTime() - b.echeance.getTime());

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

  const parCategorie = (c: string) =>
    editeursParCategorie.find((g) => g.categorie === c)?._count ?? 0;

  return {
    nbLogiciels: logiciels.length,
    nbEnProduction: logiciels.filter((l) => l.statut === "production").length,
    nbEditeurs: editeursParCategorie.reduce((n, g) => n + g._count, 0),
    nbAutorites: parCategorie("autorite_certification"),
    nbContrats,
    nbServeurs,
    nbCertificats,
    coutAnnuelTotal,
    contratsDepasses,
    tachesEnRetard,
    taches: tachesAFaire,
    seuilRenouvellementJours: seuilJours,
    renouvellements,
    seuilCertificatJours: seuilCertificat,
    certificats,
    parHebergement,
    parCriticite,
  };
}
