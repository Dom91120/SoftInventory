/**
 * Les onglets de la fiche éditeur — la société, ses interlocuteurs, ses pièces.
 * Module SANS « use client » : la page (serveur) lit l'onglet demandé par
 * l'URL, le formulaire (client) rend la barre — les deux importent d'ici.
 */
export const ONGLETS_EDITEUR = [
  { key: "synthese", label: "Synthèse" },
  { key: "contacts", label: "Contacts" },
  { key: "documents", label: "Documents" },
] as const;

export type OngletEditeur = (typeof ONGLETS_EDITEUR)[number]["key"];

/** Tout ce qui n'est pas une clé connue retombe sur la Synthèse. */
export function ongletEditeur(brut: string | undefined): OngletEditeur {
  return ONGLETS_EDITEUR.some((o) => o.key === brut) ? (brut as OngletEditeur) : "synthese";
}
