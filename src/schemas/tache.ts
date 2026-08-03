import { z } from "zod";

export const PERIODICITES = [
  "mensuelle",
  "trimestrielle",
  "semestrielle",
  "annuelle",
  "personnalisee",
  "ponctuelle",
] as const;

export const STATUTS_TACHE = ["active", "en_pause", "terminee"] as const;

export const LIBELLES_TACHE = {
  periodicite: {
    mensuelle: "Mensuelle",
    trimestrielle: "Trimestrielle",
    semestrielle: "Semestrielle",
    annuelle: "Annuelle",
    personnalisee: "Personnalisée (n mois)",
    ponctuelle: "Ponctuelle",
  },
  statut: {
    active: "Active",
    en_pause: "En pause",
    terminee: "Terminée",
  },
} as const;

const dateRequise = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Échéance invalide (date attendue).")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

/** Création/édition d'une tâche récurrente. */
export const tacheSchema = z
  .object({
    titre: z
      .string()
      .trim()
      .min(1, "Le titre est obligatoire.")
      .max(200, "Titre trop long (200 caractères max)."),
    description: z.string().trim().max(2000, "Description trop longue (2000 caractères max)."),
    typeTacheId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1), "Type de tâche invalide."),
    periodicite: z.enum(PERIODICITES),
    moisPersonnalises: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine(
        (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 120),
        "Intervalle en mois invalide (1 à 120).",
      ),
    prochaineEcheance: dateRequise,
    statut: z.enum(STATUTS_TACHE),
    assigneUserId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v)),
    assigneLibre: z.string().trim().max(150, "Nom trop long (150 caractères max)."),
    rappelJoursAvant: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine(
        (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 365),
        "Délai de rappel invalide (0 à 365 jours).",
      ),
  })
  .superRefine((val, ctx) => {
    if (val.periodicite === "personnalisee" && val.moisPersonnalises === null) {
      ctx.addIssue({
        code: "custom",
        path: ["moisPersonnalises"],
        message: "Indiquez l'intervalle en mois de la périodicité personnalisée.",
      });
    }
  });
export type TacheInput = z.infer<typeof tacheSchema>;

/** Complétion d'une occurrence. */
export const completerTacheSchema = z.object({
  commentaire: z.string().trim().max(1000, "Commentaire trop long (1000 caractères max)."),
});
