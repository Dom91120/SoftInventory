import { z } from "zod";

// Schémas zod de la fiche logiciel — SOURCE UNIQUE des règles et messages,
// partagée par les formulaires client et les server actions.

/** "" → null, sinon date valide (les <input type="date"> envoient AAAA-MM-JJ). */
const dateOptionnelle = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide.")
  .transform((v) => (v === null ? null : new Date(`${v}T00:00:00.000Z`)));

/** "" → null, sinon montant positif (virgule française acceptée). */
const montantOptionnel = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(",", ".").replace(/\s/g, ""))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Montant invalide.")
  .refine((v) => v === null || v < 10_000_000_000, "Montant trop grand.");

/** "" → null, sinon id entier positif (selects « — aucun — »). */
const idOptionnel = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1), "Choix invalide.");

/**
 * "" → null, sinon entier d'une plage FERMÉE : les listes et compteurs dont
 * l'écran ne propose qu'une poignée de valeurs. Le vide dit « non renseigné »,
 * et une borne basse à zéro laisse zéro être une réponse.
 */
const entierBorne = (min: number, max: number, quoi: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= min && v <= max),
      `${quoi} : valeur attendue entre ${min} et ${max}.`,
    );

/** "" → null, sinon entier positif. Le vide dit « non renseigné », pas zéro. */
const entierOptionnel = (max: number, quoi: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max),
      `${quoi} : entier positif attendu (${max} max).`,
    );

export const HEBERGEMENTS = ["saas", "on_premise", "hybride"] as const;
export const CYCLES_DE_VIE = ["evaluation", "production", "fin_de_vie", "abandonne"] as const;
export const TYPES_SOURCE = ["opensource", "proprietaire", "mixte"] as const;
export const MODES_AUTH = ["locale", "sso", "ldap", "mixte", "aucune"] as const;
export const LOCALISATIONS = ["ue", "hors_ue", "mixte", "inconnue"] as const;
/** Ce qu'est l'acte. Vide = non renseigné, d'où l'absence de valeur par défaut. */
export const NATURES_MARCHE = ["marche", "contrat"] as const;
export const ENVIRONNEMENTS = ["production", "test", "recette", "formation"] as const;

// Libellés d'affichage des enums (une seule traduction pour toute l'app).
// L'hébergement n'y est plus : ses libellés s'administrent dans Référentiels ›
// Hébergements, et une copie en dur ici finirait par contredire la table.
export const LIBELLES = {
  statut: {
    evaluation: "En évaluation",
    production: "Production",
    fin_de_vie: "Fin de vie",
    abandonne: "Abandonné",
  },
  typeSource: { opensource: "Open source", proprietaire: "Propriétaire", mixte: "Mixte" },
  authentification: {
    locale: "Locale",
    sso: "SSO",
    ldap: "LDAP / Active Directory",
    mixte: "Mixte",
    aucune: "Aucune",
  },
  localisationDonnees: {
    ue: "Union européenne",
    hors_ue: "Hors UE",
    mixte: "Mixte",
    inconnue: "Inconnue",
  },
  natureMarche: { marche: "Marché", contrat: "Contrat" },
  environnement: {
    production: "Production",
    test: "Test",
    recette: "Recette",
    formation: "Formation",
  },
} as const;

/**
 * Valeur sentinelle de la liste « Éditeur / fournisseur » : le logiciel est
 * fait maison, il n'y a donc pas d'éditeur à désigner. Elle ne vit QUE dans
 * l'écran et le formulaire — en base, c'est le booléen `developpementInterne`
 * qui porte l'information. Un éditeur sentinelle « Développement interne » dans
 * la table aurait pollué l'annuaire et toutes les listes de fournisseurs.
 */
export const EDITEUR_INTERNE = "interne";

/** Fiche principale (onglet Synthèse). */
export const logicielSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom du logiciel est obligatoire.")
    .max(150, "Nom trop long (150 caractères max)."),
  description: z.string().trim().max(4000, "Description trop longue (4000 caractères max)."),
  editeurId: idOptionnel,
  /** Fait par la DSI : ni éditeur, ni support, ni contrat à rattacher. */
  developpementInterne: z.boolean(),
  technologieId: idOptionnel,
  criticiteId: idOptionnel,
  hebergement: z.enum(HEBERGEMENTS),
  typeSource: z.enum(TYPES_SOURCE),
  statut: z.enum(CYCLES_DE_VIE),
  versionInstallee: z.string().trim().max(60, "Version trop longue (60 caractères max)."),
  url: z
    .string()
    .trim()
    .max(300, "URL trop longue (300 caractères max).")
    .refine(
      (v) => v === "" || /^https?:\/\/\S+$/i.test(v),
      "URL invalide (elle doit commencer par http:// ou https://).",
    ),
  dateMiseEnService: dateOptionnelle,
  authentification: z.enum(MODES_AUTH),
  // Vide = non compté (null), à distinguer de zéro utilisateur.
  nbUtilisateurs: entierOptionnel(1_000_000, "Nombre d'utilisateurs"),
  // Vide = illimité.
  nbMaxUtilisateurs: entierOptionnel(1_000_000, "Nombre de licences"),
  referentMetier: z.string().trim().max(150, "Référent métier trop long (150 caractères max)."),
  referentTechnique: z
    .string()
    .trim()
    .max(150, "Référent technique trop long (150 caractères max)."),
  // `coutAnnuel` et `finContratLe` ne sont plus saisis : le MARCHÉ rattaché
  // porte le montant et l'échéance, avec ses propres rappels. Les colonnes
  // restent en base — leurs valeurs historiques ne sont pas détruites — mais
  // plus rien ne les écrit ni ne les lit.
});
export type LogicielInput = z.infer<typeof logicielSchema>;

/** Volet RGPD (onglet dédié). */
export const logicielRgpdSchema = z.object({
  donneesPersonnelles: z.boolean(),
  categoriesDonnees: z
    .string()
    .trim()
    .max(1000, "Catégories de données trop longues (1000 caractères max)."),
  registreRef: z
    .string()
    .trim()
    .max(150, "Référence au registre trop longue (150 caractères max)."),
  localisationDonnees: z.enum(LOCALISATIONS),
});
export type LogicielRgpdInput = z.infer<typeof logicielRgpdSchema>;

/**
 * Contrat ou marché (onglet Contrats) : ce qui l'IDENTIFIE, plus ce qui
 * l'engage globalement — montant annuel et date de fin.
 *
 * Ces deux champs ne doublent pas ceux des pièces : la pièce chiffre UN poste
 * et son renouvellement, le marché chiffre l'ensemble et son terme. Ils sont
 * saisis, jamais calculés depuis les pièces — la somme des postes connus ne
 * vaut pas le montant engagé.
 */
export const contratSchema = z
  .object({
    // Marché ou contrat. "" → null : rien n'oblige à trancher, et les lignes
    // reprises de l'historique n'ont pas été dépouillées sur ce point.
    nature: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine(
        (v) => v === null || (NATURES_MARCHE as readonly string[]).includes(v),
        "Nature invalide.",
      )
      .transform((v) => v as (typeof NATURES_MARCHE)[number] | null),
    libelle: z.string().trim().max(150, "Libellé trop long (150 caractères max)."),
    // Vide = l'éditeur du logiciel ; renseigné quand on contractualise avec un revendeur.
    fournisseurId: idOptionnel,
    referenceMarche: z
      .string()
      .trim()
      .max(120, "Référence marché/contrat trop longue (120 caractères max)."),
    // Celle du FOURNISSEUR pour le même acte : son numéro de commande ou de
    // contrat, celui qu'il redemande au téléphone.
    referenceFournisseur: z
      .string()
      .trim()
      .max(120, "Référence fournisseur trop longue (120 caractères max)."),
    montantAnnuel: montantOptionnel,
    // Maximum ANNUEL, sans contrainte avec le montant annuel : c'est l'acte qui
    // fait foi, l'outil enregistre ce qu'il dit.
    montantMaxi: montantOptionnel,
    // Le marché sur sa durée entière. Sans contrainte non plus avec les deux
    // autres : trois chiffres que l'acte donne, pas trois vues d'un même.
    montantTotal: montantOptionnel,
    dateDebut: dateOptionnelle,
    // Terme du marché ET échéance surveillée : c'est elle que lisent le cron
    // et le tableau de bord. La changer relance un rappel (voir updateContrat).
    dateFin: dateOptionnelle,
    // Durée ferme et reconductions : ce que l'acte fixe, et que la période
    // affichée ne dit pas. Bornes larges assumées — un marché public court
    // rarement au-delà de quatre ans, reconductions comprises.
    dureeAnnees: entierBorne(1, 4, "Durée"),
    renouvellements: entierBorne(0, 3, "Renouvellements"),
    notes: z.string().trim().max(2000, "Notes trop longues (2000 caractères max)."),
  })
  // Les deux dates forment une période : une fin antérieure au début est une
  // faute de frappe, pas une donnée. Contrôle seulement quand les DEUX sont
  // renseignées — un marché en cours n'a souvent que son début.
  .refine((v) => v.dateDebut === null || v.dateFin === null || v.dateDebut <= v.dateFin, {
    path: ["dateFin"],
    message: "La date de fin ne peut pas précéder la date de début.",
  });
export type ContratInput = z.infer<typeof contratSchema>;

/**
 * Pièce d'un contrat : la date de son document, et rien d'autre — c'est le
 * fichier qui la porte.
 *
 * Tout ce qu'elle chiffrait ou surveillait est remonté au marché, qui engage :
 *  - `type` (perpétuelle / abonnement / libre / autre) → la catégorie du
 *    document, référentiel que l'admin fait évoluer ;
 *  - `dateRenouvellement` → `Contrat.dateFin`, seule échéance surveillée ;
 *  - `coutAnnuel` → `Contrat.montantAnnuel`.
 *
 * Les colonnes `type` et `cout_annuel` demeurent en base avec leurs valeurs
 * historiques ; elles ne sont plus ni saisies ni affichées.
 */
export const pieceContratSchema = z.object({
  datePiece: dateOptionnelle,
});
export type PieceContratInput = z.infer<typeof pieceContratSchema>;

/** Mise en concurrence (onglet Devis) : l'objet consulté et sa date. */
export const consultationSchema = z.object({
  objet: z
    .string()
    .trim()
    .min(1, "L'objet de la consultation est obligatoire.")
    .max(150, "Objet trop long (150 caractères max)."),
  date: dateOptionnelle,
});
export type ConsultationInput = z.infer<typeof consultationSchema>;

/**
 * Devis reçu dans une consultation : qui, combien, quand — ce qui départage les
 * offres. La pièce jointe et la marque « retenu » se pilotent à part
 * (dépôt direct sur la ligne, marquerDevisRetenu).
 */
export const devisSchema = z.object({
  // Vide = fournisseur non renseigné (devis reçu d'une société pas encore
  // dans l'annuaire) : on n'oblige pas à créer une fiche pour saisir un devis.
  fournisseurId: idOptionnel,
  montant: montantOptionnel,
  date: dateOptionnelle,
});
export type DevisInput = z.infer<typeof devisSchema>;
