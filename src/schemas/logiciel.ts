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
export const TYPES_CONTRAT = ["perpetuelle", "abonnement", "libre", "autre"] as const;
export const ENVIRONNEMENTS = ["production", "test", "recette", "formation"] as const;

// Libellés d'affichage des enums (une seule traduction pour toute l'app).
export const LIBELLES = {
  hebergement: { saas: "SaaS", on_premise: "On premise", hybride: "Hybride" },
  statut: {
    evaluation: "En évaluation",
    production: "En production",
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
  typeContrat: {
    perpetuelle: "Perpétuelle",
    abonnement: "Abonnement",
    libre: "Libre",
    autre: "Autre",
  },
  environnement: {
    production: "Production",
    test: "Test",
    recette: "Recette",
    formation: "Formation",
  },
} as const;

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
  coutAnnuel: montantOptionnel,
  finContratLe: dateOptionnelle,
  notes: z.string().trim().max(8000, "Notes trop longues (8000 caractères max)."),
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
 * Contrat ou marché (onglet Contrats) : ce qui l'IDENTIFIE. Ni montant ni
 * échéance — ceux-ci appartiennent à ses lignes.
 */
export const contratSchema = z.object({
  libelle: z.string().trim().max(150, "Libellé trop long (150 caractères max)."),
  // Vide = l'éditeur du logiciel ; renseigné quand on contractualise avec un revendeur.
  fournisseurId: idOptionnel,
  referenceMarche: z
    .string()
    .trim()
    .max(120, "Référence marché/contrat trop longue (120 caractères max)."),
  notes: z.string().trim().max(2000, "Notes trop longues (2000 caractères max)."),
});
export type ContratInput = z.infer<typeof contratSchema>;

/** Pièce d'un contrat : son type, son coût, son échéance. */
export const pieceContratSchema = z.object({
  type: z.enum(TYPES_CONTRAT),
  coutAnnuel: montantOptionnel,
  dateRenouvellement: dateOptionnelle,
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
