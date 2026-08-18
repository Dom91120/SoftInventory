import { z } from "zod";

// Schémas zod du certificat électronique — SOURCE UNIQUE des règles et
// messages, partagée par le formulaire client et les server actions.

export const CIVILITES = ["m", "mme"] as const;
export const USAGES_CERTIFICAT = ["signature", "authentification", "cachet", "autre"] as const;
export const SUPPORTS_CERTIFICAT = ["carte", "cle_usb", "logiciel", "autre"] as const;
export const STATUTS_CERTIFICAT = ["valide", "revoque", "suspendu"] as const;

export const LIBELLES_CERTIFICAT = {
  civilite: { m: "M.", mme: "Mme" },
  usage: {
    signature: "Signature",
    authentification: "Authentification",
    cachet: "Cachet serveur",
    autre: "Autre",
  },
  support: {
    carte: "Carte à puce",
    cle_usb: "Clé USB",
    logiciel: "Fichier logiciel",
    autre: "Autre",
  },
  // « Expiré » n'y figure pas : ce n'est pas un statut, c'est une lecture de
  // la date de fin. Son libellé vit avec le calcul, dans `shared.ts`.
  statut: {
    valide: "Valide",
    revoque: "Révoqué",
    suspendu: "Suspendu",
  },
} as const;

/**
 * Le titulaire tel qu'on le LIT : « Mme MILLARD REVENEAU Marie-Christine ».
 * Civilité, NOM, prénom — l'ordre du tableau d'origine, celui sous lequel ces
 * fiches ont toujours été lues. Les trois sont stockés à part, c'est ce qui
 * rend le tri et la recherche justes, mais ils ne se lisent jamais séparés.
 *
 * Une seule fonction pour les six endroits qui nomment un titulaire (liste,
 * fiche, tableau de bord, export, rappel par courriel, flèches voisin), sans
 * quoi ils auraient fini par ne plus dire la même chose.
 */
export function nomTitulaire(c: {
  civilite: string | null;
  titulaire: string;
  prenom?: string;
}): string {
  const civ =
    c.civilite === "m" || c.civilite === "mme" ? LIBELLES_CERTIFICAT.civilite[c.civilite] : "";
  return [civ, c.titulaire, c.prenom?.trim()].filter(Boolean).join(" ");
}

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

const emailOptionnel = z
  .string()
  .trim()
  .max(200, "Adresse e-mail trop longue (200 caractères max).")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Adresse e-mail invalide.");

/** "" → null, sinon une des valeurs admises. Le vide dit « non renseigné ». */
const enumOptionnel = <T extends readonly string[]>(valeurs: T, quoi: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (valeurs as readonly string[]).includes(v), `${quoi} invalide.`)
    .transform((v) => v as T[number] | null);

/**
 * Création/édition d'un certificat électronique.
 *
 * Le TITULAIRE est le seul champ obligatoire : une fiche sans nom ne se
 * retrouve pas. Tout le reste peut manquer — les lignes reprises du tableau
 * d'origine n'avaient ni numéro de série, ni support, ni e-mail, et refuser de
 * les enregistrer aurait condamné la reprise.
 */
export const certificatSchema = z
  .object({
    // Nulle plutôt que « » : un certificat de machine n'a pas de civilité, et
    // la liste s'ouvre sur « — aucune — » plutôt que sur un « M. » présumé.
    civilite: enumOptionnel(CIVILITES, "Civilité"),
    titulaire: z
      .string()
      .trim()
      .min(1, "Le titulaire est obligatoire.")
      .max(150, "Titulaire trop long (150 caractères max)."),
    // Facultatif, et il le restera : une machine n'en a pas, et l'inventaire
    // n'a longtemps porté que des patronymes.
    prenom: z.string().trim().max(80, "Prénom trop long (80 caractères max)."),
    fonction: z.string().trim().max(120, "Fonction trop longue (120 caractères max)."),
    email: emailOptionnel,
    fournisseurId: idOptionnel,
    serviceId: idOptionnel,
    serveurId: idOptionnel,
    usage: enumOptionnel(USAGES_CERTIFICAT, "Usage"),
    support: enumOptionnel(SUPPORTS_CERTIFICAT, "Support"),
    niveau: z.string().trim().max(60, "Niveau trop long (60 caractères max)."),
    numeroSerie: z.string().trim().max(120, "Numéro de série trop long (120 caractères max)."),
    dateDebut: dateOptionnelle,
    // Terme de validité ET échéance surveillée : c'est elle que lisent le cron
    // et le tableau de bord. La changer relance un rappel (voir updateCertificat).
    dateFin: dateOptionnelle,
    // Cinq ans : au-delà, aucune autorité ne délivre — la borne attrape la
    // faute de frappe, pas un cas légitime.
    dureeAnnees: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine(
        (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5),
        "Durée : valeur attendue entre 1 et 5 ans.",
      ),
    montantTtc: montantOptionnel,
    imputation: z.string().trim().max(30, "Imputation trop longue (30 caractères max)."),
    bonCommandeLe: dateOptionnelle,
    // Le statut, lui, a une valeur par défaut : un certificat qu'on saisit est
    // valide jusqu'à preuve du contraire.
    statut: z
      .string()
      .trim()
      .refine((v) => (STATUTS_CERTIFICAT as readonly string[]).includes(v), "Statut invalide.")
      .transform((v) => v as (typeof STATUTS_CERTIFICAT)[number]),
    notes: z.string().trim().max(2000, "Notes trop longues (2000 caractères max)."),
  })
  // Les deux dates forment une période de validité : une fin antérieure au
  // début est une faute de frappe, pas une donnée. Contrôle seulement quand les
  // DEUX sont renseignées.
  .refine((v) => v.dateDebut === null || v.dateFin === null || v.dateDebut <= v.dateFin, {
    path: ["dateFin"],
    message: "La date de fin ne peut pas précéder la date de début.",
  });
export type CertificatInput = z.infer<typeof certificatSchema>;

/**
 * Les deux codes remis par l'autorité, SÉPARÉS du reste de la fiche.
 *
 * Ils voyagent dans leur propre schéma parce qu'ils voyagent dans leur propre
 * formulaire, réservé aux admins : un lecteur ne les reçoit pas du serveur, et
 * son enregistrement de la fiche ne peut donc pas les effacer par omission —
 * ce qui serait arrivé s'ils avaient partagé le POST des autres champs.
 */
export const codesCertificatSchema = z.object({
  codeRevocation: z.string().trim().max(100, "Code de révocation trop long (100 caractères max)."),
  codeRetrait: z.string().trim().max(100, "Code de retrait trop long (100 caractères max)."),
});
export type CodesCertificatInput = z.infer<typeof codesCertificatSchema>;
