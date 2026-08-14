/**
 * Les onglets de la fiche d'un marché — l'acte et ce qu'il couvre, puis ses
 * pièces. Module SANS « use client » : la page (serveur) lit l'onglet demandé
 * par l'URL, le formulaire (client) rend la barre — les deux importent d'ici.
 */
export const ONGLETS_CONTRAT = [
  { key: "synthese", label: "Synthèse" },
  { key: "documents", label: "Documents" },
] as const;

export type OngletContrat = (typeof ONGLETS_CONTRAT)[number]["key"];

/** Tout ce qui n'est pas une clé connue retombe sur la Synthèse. */
export function ongletContrat(brut: string | undefined): OngletContrat {
  return ONGLETS_CONTRAT.some((o) => o.key === brut) ? (brut as OngletContrat) : "synthese";
}
