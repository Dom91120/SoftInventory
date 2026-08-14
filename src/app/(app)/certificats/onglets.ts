/**
 * Les onglets de la fiche d'un certificat — la fiche elle-même, ses pièces,
 * les codes de l'autorité. Module SANS « use client » : la page (serveur) lit
 * l'onglet demandé par l'URL, le formulaire (client) rend la barre — les deux
 * importent d'ici.
 *
 * « Révocation » et non « Codes » : l'onglet porte le nom du geste qu'on vient
 * y faire — révoquer ou retirer le certificat chez l'autorité — pas celui de ce
 * qu'il contient. Il n'est offert qu'aux admins, seuls à voir la carte.
 */
export const ONGLETS_CERTIFICAT = [
  { key: "synthese", label: "Synthèse" },
  { key: "documents", label: "Documents" },
  { key: "revocation", label: "Révocation" },
] as const;

export type OngletCertificat = (typeof ONGLETS_CERTIFICAT)[number]["key"];

/** Tout ce qui n'est pas une clé connue retombe sur la Synthèse. */
export function ongletCertificat(brut: string | undefined): OngletCertificat {
  return ONGLETS_CERTIFICAT.some((o) => o.key === brut) ? (brut as OngletCertificat) : "synthese";
}
