"use client";

import { useRouter } from "next/navigation";

/**
 * « Quitter » de la page du compte, sous les deux cartes plutôt que dans l'une
 * d'elles : le geste ne porte ni sur le profil ni sur le mot de passe, mais sur
 * la page entière, une fois tout dit.
 *
 * Retour au tableau de bord, et non à la page précédente : la page du compte
 * n'est la fiche d'aucune liste, et c'est de là qu'on vient en passant par le
 * menu du compte. Un retour d'historique, lui, ferait sortir de l'application
 * quand on est arrivé par une URL collée ou un rechargement.
 */
export function BoutonQuitter() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/tableau-de-bord")}
      className="btn-secondary"
      title="Revenir au tableau de bord"
    >
      Quitter
    </button>
  );
}
