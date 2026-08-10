"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Préfixe des clés de `sessionStorage`, une par liste (le chemin fait la clé :
 * `/logiciels`, `/editeurs`, `/contrats`). Toute liste qui affichera un jour un
 * pavé de pagination héritera de la mémoire sans rien avoir à déclarer.
 */
const PREFIXE = "liste-page:";

/**
 * Mémoire du numéro de page d'une liste, le temps d'une session.
 *
 * Consulter la page 4 de l'inventaire, ouvrir une fiche, la refermer et
 * retomber page 1 obligeait à refaire quatre fois le chemin. La liste retient
 * donc où on l'avait laissée et y revient d'elle-même.
 *
 * `sessionStorage` plutôt que `localStorage` : la portée demandée est la
 * session — la mémoire meurt avec l'onglet, et `oublierPagesMemorisees` en fait
 * autant à la déconnexion. Un numéro de page n'a pas à survivre au compte qui
 * l'a laissé là.
 *
 * DEUX règles délimitent le rattrapage, pour qu'il ne se mette jamais en
 * travers d'une navigation voulue :
 *
 * - il n'a lieu qu'à l'ARRIVÉE sur la liste (premier rendu du composant). Les
 *   flèches du pavé et les filtres ne font que changer la query string d'une
 *   route déjà montée : on y écrit la nouvelle page, on ne la corrige pas.
 *   Sans cela, revenir page 1 renverrait aussitôt à la page mémorisée ;
 * - et seulement sur une URL NUE. `…?statut=production` ou `…?page=2` disent
 *   déjà ce qu'ils veulent voir — un lien du tableau de bord, un favori, une
 *   adresse partagée. La mémoire ne parle que quand personne d'autre ne parle.
 *
 * Un numéro devenu trop grand (la liste a maigri) ne montre pas une page vide :
 * `paginer` le ramène dans les bornes.
 */
export function MemoirePage({ page }: { page: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  /** Vrai au premier rendu seulement : c'est ce qui distingue l'arrivée. */
  const arrivee = useRef(true);

  useEffect(() => {
    const cle = PREFIXE + pathname;
    if (arrivee.current) {
      arrivee.current = false;
      if ([...params.keys()].length === 0) {
        let memo = 0;
        try {
          memo = Number(sessionStorage.getItem(cle));
        } catch {}
        if (Number.isInteger(memo) && memo > 1) {
          // `replace` et non `push` : la page rattrapée prend la place de la
          // page 1 qu'on n'a fait que traverser, sinon « Précédent » y
          // ramènerait aussitôt.
          router.replace(`${pathname}?page=${memo}`);
          return;
        }
      }
    }
    try {
      sessionStorage.setItem(cle, String(page));
    } catch {}
  }, [page, pathname, params, router]);

  return null;
}

/**
 * Efface la mémoire de toutes les listes. Appelée à la déconnexion ET à la
 * connexion : une session expirée ne passe pas par le bouton « Se déconnecter »,
 * et le compte suivant ne doit pas hériter des pages du précédent.
 */
export function oublierPagesMemorisees() {
  try {
    for (const cle of Object.keys(sessionStorage)) {
      if (cle.startsWith(PREFIXE)) sessionStorage.removeItem(cle);
    }
  } catch {}
}
