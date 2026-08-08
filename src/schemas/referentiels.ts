import { z } from "zod";

// Schémas zod des référentiels — SOURCE UNIQUE des règles et des messages,
// partagée par les formulaires client et les server actions.

const label = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Le libellé est obligatoire.")
    .max(max, `Libellé trop long (${max} caractères max).`);

export const serviceUtilisateurSchema = z.object({
  nom: label(120),
  contactNom: z.string().trim().max(120, "Nom de contact trop long (120 caractères max)."),
  contactEmail: z
    .string()
    .trim()
    .max(200, "Adresse trop longue (200 caractères max).")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Adresse e-mail invalide."),
  contactTelephone: z.string().trim().max(30, "Téléphone trop long (30 caractères max)."),
});
export type ServiceUtilisateurInput = z.infer<typeof serviceUtilisateurSchema>;

export const serveurSchema = z.object({
  nom: label(120),
  os: z.string().trim().max(80, "OS trop long (80 caractères max)."),
  localisation: z.string().trim().max(120, "Localisation trop longue (120 caractères max)."),
  notes: z.string().trim().max(2000, "Notes trop longues (2000 caractères max)."),
});
export type ServeurInput = z.infer<typeof serveurSchema>;

export const technologieSchema = z.object({ label: label(80) });
export type TechnologieInput = z.infer<typeof technologieSchema>;

export const criticiteSchema = z.object({
  label: label(80),
  rank: z.coerce
    .number()
    .int("Le rang doit être un entier.")
    .min(0, "Le rang doit être positif.")
    .max(99, "Rang trop grand (99 max)."),
  couleur: z
    .string()
    .trim()
    .max(9)
    .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Couleur attendue au format #rrggbb."),
  description: z.string().trim().max(300, "Description trop longue (300 caractères max)."),
});
export type CriticiteInput = z.infer<typeof criticiteSchema>;

/**
 * Statut du cycle de vie : seuls le libellé et la couleur se modifient. La clé
 * (`evaluation`, `production`…) porte la logique et n'est pas éditable — d'où
 * un schéma sans elle, qui empêche aussi de la glisser par le formulaire.
 */
export const statutLogicielSchema = z.object({
  label: label(80),
  couleur: z
    .string()
    .trim()
    .max(9)
    .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Couleur attendue au format #rrggbb."),
});
export type StatutLogicielInput = z.infer<typeof statutLogicielSchema>;

/**
 * Mode d'hébergement : même régime que le statut — la clé (`saas`,
 * `on_premise`, `hybride`) est portée par l'enum et absente du schéma, donc
 * inatteignable par le formulaire. L'ordre s'administre en plus, la liste étant
 * trop courte pour qu'un tri alphabétique dise quoi que ce soit.
 */
export const modeHebergementSchema = z.object({
  label: label(80),
  couleur: z
    .string()
    .trim()
    .max(9)
    .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Couleur attendue au format #rrggbb."),
  position: z.coerce
    .number()
    .int("L'ordre doit être un entier.")
    .min(0, "L'ordre doit être positif.")
    .max(99, "Ordre trop grand (99 max)."),
});
export type ModeHebergementInput = z.infer<typeof modeHebergementSchema>;

export const typeTacheSchema = z.object({ label: label(80) });
export type TypeTacheInput = z.infer<typeof typeTacheSchema>;

export const categorieDocumentSchema = z.object({ label: label(80) });
export type CategorieDocumentInput = z.infer<typeof categorieDocumentSchema>;
