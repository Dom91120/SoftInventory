"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cookiePage, estCookiePage } from "@/lib/memoire-page";

/**
 * Mémoire du numéro de page d'une liste, le temps d'une session.
 *
 * Consulter la page 4 de l'inventaire, ouvrir une fiche, la refermer et
 * retomber page 1 obligeait à refaire quatre fois le chemin. La liste retient
 * donc où on l'avait laissée et y revient d'elle-même.
 *
 * Un COOKIE, et non `sessionStorage` : c'est le SERVEUR qui choisit la page au
 * rendu (voir `pageInitiale`), si bien que la bonne page arrive toute rendue.
 * Le rattrapage côté client qu'on faisait avant — afficher la page 1, puis la
 * remplacer par la page mémorisée — se voyait à l'œil nu, la liste sautant sous
 * le curseur à chaque retour sur l'écran. Même mécanique et même raison que la
 * mémoire de vue des serveurs.
 *
 * Cookie de SESSION (aucun `max-age`) : il meurt avec le navigateur, et
 * `oublierPagesMemorisees` en fait autant à la déconnexion. Un numéro de page
 * est une position de lecture, pas une préférence — il n'a pas à survivre au
 * compte qui l'a laissé là. Il est en revanche partagé par les onglets du même
 * navigateur, là où `sessionStorage` valait par onglet : deux onglets sur la
 * même liste se donnent désormais la dernière page consultée, ce qui est le
 * comportement de la vue des serveurs depuis toujours.
 *
 * Le composant ne fait plus qu'ÉCRIRE : il note la page affichée à chaque
 * rendu, qu'elle vienne de l'URL ou du cookie lui-même.
 */
export function MemoirePage({ page }: { page: number }) {
  const pathname = usePathname();

  useEffect(() => {
    document.cookie = `${cookiePage(pathname)}=${page}; path=/; samesite=lax`;
  }, [page, pathname]);

  return null;
}

/**
 * Efface la mémoire de toutes les listes. Appelée à la déconnexion ET à la
 * connexion : une session expirée ne passe pas par le bouton « Se déconnecter »,
 * et le compte suivant ne doit pas hériter des pages du précédent.
 */
export function oublierPagesMemorisees() {
  try {
    for (const paire of document.cookie.split(";")) {
      const nom = paire.split("=")[0]?.trim();
      // `max-age=0` sur le MÊME chemin que l'écriture : un cookie ne s'efface
      // qu'en le réécrivant périmé, et sur un autre chemin on en créerait un
      // second au lieu de retirer le premier.
      if (nom && estCookiePage(nom)) document.cookie = `${nom}=; path=/; max-age=0; samesite=lax`;
    }
  } catch {}
}
