import {
  type FiltresContrats,
  SENS_PAR_DEFAUT,
  type SensTri,
  TRIS_CONTRATS,
  type TriContrat,
} from "@/server/services/contrats";

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

/**
 * Le tri lu depuis l'URL, comme les filtres — rechargeable, partageable, repris
 * par l'export et transmis aux flèches d'une fiche. Sans paramètre, la liste
 * garde l'ordre qu'elle a toujours eu : la période, du plus récent au plus
 * ancien. Le tri lui-même vit dans le service, avec les données qu'il ordonne.
 */
export function triContratsDepuisParams(p: Record<string, string | undefined>): {
  tri: TriContrat;
  sens: SensTri;
} {
  const tri = TRIS_CONTRATS.find((t) => t === p.tri) ?? "periode";
  const sens = p.sens === "asc" || p.sens === "desc" ? p.sens : SENS_PAR_DEFAUT[tri];
  return { tri, sens };
}

/**
 * Le tri porté par une URL de fiche, pour que ses flèches « précédent /
 * suivant » suivent l'ordre de la liste d'où l'on vient. Vide tant qu'aucune
 * colonne n'a été cliquée : la fiche n'a pas à traîner une query string qui ne
 * dit que le comportement par défaut.
 */
export function queryTri(p: Record<string, string | undefined>): string {
  if (!p.tri) return "";
  const { tri, sens } = triContratsDepuisParams(p);
  return `?${new URLSearchParams({ tri, sens }).toString()}`;
}
