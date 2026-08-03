import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export type Voisin = { id: number; nom: string } | null;

/**
 * Flèche de navigation vers la fiche précédente / suivante, dans l'ordre
 * alphabétique de la liste. Partagée par les fiches logiciel et éditeur.
 *
 * Format 56 × 24 px : la hauteur reprend celle du bloc titre + sous-titre
 * (2rem de titre + 0,25rem d'écart + 1,25rem de sous-titre) pour que la flèche
 * borde exactement l'en-tête, la largeur reste étroite pour ne pas empiéter
 * sur le contenu.
 *
 * En bout de liste, un bloc grisé de MÊME gabarit remplace le lien : sans lui,
 * l'en-tête se décalerait horizontalement entre la première fiche et les
 * suivantes.
 */
export function FlecheVoisin({
  voisin,
  sens,
  hrefBase,
  query = "",
  entite,
}: {
  voisin: Voisin;
  sens: "precedent" | "suivant";
  /** Racine de l'URL, ex. « /logiciels ». */
  hrefBase: string;
  /** Suffixe éventuel, ex. « ?onglet=documents » — conserve l'onglet courant. */
  query?: string;
  /** Nom de l'entité pour les libellés d'accessibilité, ex. « Logiciel ». */
  entite: string;
}) {
  const Icone = sens === "precedent" ? ChevronLeft : ChevronRight;
  const base = "flex h-14 w-6 shrink-0 items-center justify-center self-start rounded-lg";

  if (!voisin) {
    return (
      <span aria-hidden className={`${base} text-line`}>
        <Icone className="h-5 w-5" />
      </span>
    );
  }
  const mot = sens === "precedent" ? "précédent" : "suivant";
  return (
    <Link
      href={`${hrefBase}/${voisin.id}${query}`}
      title={`${mot.charAt(0).toUpperCase()}${mot.slice(1)} : ${voisin.nom}`}
      aria-label={`${entite} ${mot} : ${voisin.nom}`}
      className={`${base} border border-sub text-muted transition hover:border-accent hover:bg-inset hover:text-accent`}
    >
      <Icone className="h-5 w-5" />
    </Link>
  );
}
