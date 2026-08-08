"use client";

import { useRouter } from "next/navigation";

/**
 * « Quitter » : le geste qui referme un écran sans rien décider.
 *
 * Retour à une destination NOMMÉE, et non à la page précédente : un retour
 * d'historique ferait sortir de l'application quand on est arrivé par une URL
 * collée ou un rechargement.
 *
 * Posé sous le contenu, il ne porte pas sur une carte en particulier mais sur
 * l'écran entier, une fois tout lu. Les écrans qui ont une ligne d'actions
 * — les fiches, avec leur « Enregistrer » et leur « Annuler » — portent déjà
 * le leur : ce composant sert à ceux qui n'en ont pas.
 */
export function BoutonQuitter({ vers, titre }: { vers: string; titre: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push(vers)} className="btn-secondary" title={titre}>
      Quitter
    </button>
  );
}
