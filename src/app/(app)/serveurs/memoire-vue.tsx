"use client";

import { useEffect } from "react";

/**
 * Mémoire de la vue des serveurs (liste ou cartes).
 *
 * Même besoin que la mémoire de page des listes (`MemoirePage`) : revenir sur
 * l'écran ne doit pas défaire le choix qu'on y avait fait. Mais autre
 * mécanique — un COOKIE et non `sessionStorage`, parce que c'est le SERVEUR
 * qui choisit la vue au rendu (`page.tsx` lit le cookie quand l'URL se tait) :
 * la bonne vue arrive toute rendue, là où un rattrapage client afficherait la
 * liste puis sauterait aux cartes.
 *
 * Et autre portée — un an et non la session : le numéro de page est une
 * position de lecture, périmée sitôt l'onglet fermé ; liste ou cartes est une
 * préférence d'affichage, qui n'a pas de raison d'expirer avec l'onglet.
 * Rien d'un secret non plus : elle peut survivre à la déconnexion.
 *
 * Le composant ne fait qu'écrire : il note la vue affichée à chaque rendu,
 * qu'elle vienne de l'URL ou du cookie lui-même (réécrire la même valeur est
 * sans effet visible et rafraîchit l'échéance).
 */
export function MemoireVue({ vue }: { vue: string }) {
  useEffect(() => {
    document.cookie = `vue-serveurs=${vue}; path=/; max-age=31536000; samesite=lax`;
  }, [vue]);
  return null;
}
