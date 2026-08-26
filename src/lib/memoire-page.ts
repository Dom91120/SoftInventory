/**
 * Le NOM du cookie où une liste retient son numéro de page. Module neutre —
 * ni serveur ni client — parce que les deux bouts s'en servent : le composant
 * qui écrit le cookie depuis le navigateur, et la page qui le relit au rendu.
 * Deux définitions du même nom auraient fini par ne plus se répondre.
 *
 * Le chemin fait la clé (`/logiciels`, `/editeurs`, `/contrats`…) : toute liste
 * qui affichera un jour un pavé de pagination hérite de la mémoire sans rien
 * avoir à déclarer.
 */
const PREFIXE = "liste-page-";

/**
 * Nom de cookie d'une liste. Les caractères hors [a-z0-9-] sont réduits à un
 * tiret : un nom de cookie ne peut porter ni « / » ni « : » (RFC 6265), et le
 * chemin en contient toujours au moins un.
 */
export function cookiePage(chemin: string): string {
  return (
    PREFIXE +
    chemin
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
  );
}

/** Vrai pour les cookies de cette mémoire — ce qu'efface la déconnexion. */
export function estCookiePage(nom: string): boolean {
  return nom.startsWith(PREFIXE);
}

/** Le numéro retenu, ou 1 : un cookie absent, vide ou bricolé ouvre la liste. */
export function pageMemorisee(valeur: string | undefined): number {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
