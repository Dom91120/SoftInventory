import type { FiltresContrats } from "@/server/services/contrats";

/**
 * Filtres de la liste des marchés lus depuis l'URL. Partagé par l'écran et sa
 * route d'export : les deux comprennent la même query string, donc le fichier
 * contient exactement ce que la liste montre.
 *
 * Une valeur illisible est ignorée plutôt que refusée — une URL bricolée
 * n'affiche pas d'erreur, elle affiche la liste entière.
 */
export function filtresContratsDepuisParams(
  p: Record<string, string | undefined>,
): FiltresContrats {
  const n = Number(p.fournisseur);
  return {
    q: p.q?.trim() || undefined,
    fournisseurId: Number.isInteger(n) && n >= 1 ? n : undefined,
  };
}
