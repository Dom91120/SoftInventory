"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * L'emplacement que `<Onglets idActions=…>` ouvre au bout de sa rangée. Un seul
 * par écran : un onglet ne montre qu'un panneau à la fois, et c'est lui qui s'y
 * installe.
 */
export const ID_COMMANDES_ONGLET = "commandes-onglet";

/**
 * Dépose ses enfants dans cet emplacement, par portail. Ils restent dans l'arbre
 * React du panneau — ils lisent son état, ses gestionnaires sont les siens —
 * tout en s'affichant à la hauteur des onglets.
 *
 * POURQUOI là plutôt que dans l'en-tête des cartes, où ces crayons vivaient : un
 * panneau en compte parfois trois, pour un seul geste de « je veux modifier cet
 * onglet ». Le lecteur cherchait lequel commandait quoi ; et sur la Synthèse,
 * deux crayons pilotaient rigoureusement le même verrou.
 *
 * `dansLaBarre` à faux rend les enfants SUR PLACE : les panneaux partagés
 * (documents) servent aussi des écrans sans barre d'onglets, où le portail
 * n'aurait nulle part où se poser.
 */
export function CommandesOnglet({
  dansLaBarre = true,
  children,
}: {
  dansLaBarre?: boolean;
  children: ReactNode;
}) {
  /**
   * Cherché APRÈS le premier rendu — au rendu serveur, il n'y a pas de
   * document. L'emplacement manque aussi sur les écrans de CRÉATION, qui n'ont
   * pas d'onglets : les commandes n'y paraissent alors pas, et c'est bien ainsi
   * — une fiche qu'on est en train de saisir n'a aucun verrou à lever.
   */
  const [emplacement, setEmplacement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (dansLaBarre) setEmplacement(document.getElementById(ID_COMMANDES_ONGLET));
  }, [dansLaBarre]);

  if (!dansLaBarre) return <>{children}</>;
  return emplacement ? createPortal(children, emplacement) : null;
}
