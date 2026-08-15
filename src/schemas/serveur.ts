import { z } from "zod";

/**
 * Familles de systèmes — ce qui décide des outils d'administration. La VERSION
 * exacte, elle, se saisit en clair dans `os`. Vide = non renseigné, d'où
 * l'absence de valeur par défaut : rien n'oblige à trancher, et le parc repris
 * de l'existant n'a pas été dépouillé sur ce point.
 */
export const TYPES_OS = ["windows", "linux"] as const;

/** Libellés d'affichage — une seule traduction pour toute l'application. */
export const LIBELLES_TYPE_OS = { windows: "Windows", linux: "Linux" } as const;

/**
 * Schéma du serveur — SOURCE UNIQUE des règles et des messages, partagée par le
 * formulaire client et les server actions.
 *
 * Il vit à part de `schemas/referentiels.ts` depuis que le serveur a sa propre
 * fiche : ce n'est plus une ligne de liste de valeurs qu'on complète au fil de
 * l'eau, mais une machine qu'on décrit, qu'on retrouve et qui porte des
 * logiciels et des certificats. Sa table `serveurs` l'a toujours été.
 */
export const serveurSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom du serveur est obligatoire.")
    .max(120, "Nom trop long (120 caractères max)."),
  /** Machine virtuelle. Le parc l'est presque entièrement : vrai par défaut. */
  virtuel: z.boolean(),
  // "" → null : la liste s'ouvre sur « — non renseigné — », et ce vide-là est
  // une réponse. Même façon de faire que la nature d'un marché.
  typeOs: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (TYPES_OS as readonly string[]).includes(v), "Type invalide.")
    .transform((v) => v as (typeof TYPES_OS)[number] | null),
  os: z.string().trim().max(80, "OS trop long (80 caractères max)."),
  localisation: z.string().trim().max(120, "Localisation trop longue (120 caractères max)."),
  notes: z.string().trim().max(2000, "Notes trop longues (2000 caractères max)."),
});
export type ServeurInput = z.infer<typeof serveurSchema>;
