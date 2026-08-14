import { z } from "zod";

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
  os: z.string().trim().max(80, "OS trop long (80 caractères max)."),
  localisation: z.string().trim().max(120, "Localisation trop longue (120 caractères max)."),
  notes: z.string().trim().max(2000, "Notes trop longues (2000 caractères max)."),
});
export type ServeurInput = z.infer<typeof serveurSchema>;
