"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
 *
 * Composant CLIENT, et c'est l'onglet qui l'exige : `FicheOnglets` bascule sans
 * recharger la page — il pousse le nouvel `?onglet=` dans l'URL par `pushState`
 * et la page (serveur) n'est pas rejouée. Le `query` que celle-ci a calculé au
 * chargement est donc figé sur l'onglet d'arrivée, et la flèche ramenait à la
 * Synthèse dès qu'on avait changé d'onglet à la main. On relit l'onglet dans
 * l'URL VIVANTE — Next tient `useSearchParams` à jour après un `pushState` — et
 * on ne touche à rien d'autre : le tri de la liste, lui, vient bien du serveur.
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
  const params = useSearchParams();
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
  // L'onglet ouvert à l'instant du clic prime sur celui du chargement ; une
  // fiche sans onglet (le serveur) n'en pose aucun et garde son `query` tel quel.
  const q = new URLSearchParams(query.replace(/^\?/, ""));
  const ongletVivant = params.get("onglet");
  if (ongletVivant && q.has("onglet")) q.set("onglet", ongletVivant);
  const suffixe = q.toString();
  return (
    <Link
      href={`${hrefBase}/${voisin.id}${suffixe ? `?${suffixe}` : ""}`}
      title={`${mot.charAt(0).toUpperCase()}${mot.slice(1)} : ${voisin.nom}`}
      aria-label={`${entite} ${mot} : ${voisin.nom}`}
      className={`${base} border border-sub text-muted transition hover:border-accent hover:bg-inset hover:text-accent`}
    >
      <Icone className="h-5 w-5" />
    </Link>
  );
}
