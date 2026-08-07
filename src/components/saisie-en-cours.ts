"use client";

import { useCallback, useRef, useState } from "react";

/**
 * « La fiche a-t-elle été touchée depuis son dernier enregistrement ? », pour
 * les trois fiches qui portent Enregistrer et Supprimer — logiciel, éditeur,
 * marché.
 *
 * Ce qu'on en fait : tant que rien n'est saisi, la corbeille est le seul autre
 * geste possible sur la fiche. Dès qu'un champ change, elle cède la place à
 * « Annuler » — supprimer une fiche qu'on vient de modifier n'a pas de sens,
 * et revenir en arrière en a un. Le passage se fait sans confirmation : ce
 * geste ne détruit que des frappes non enregistrées, et le refuser coûterait
 * un clic à chaque hésitation.
 *
 * Non contrôlé de bout en bout : les formulaires gardent leurs `defaultValue`,
 * et `reset()` du DOM les restitue telles que le serveur les a rendues. Aucun
 * état par champ à tenir, rien à réconcilier.
 */
export function useSaisieEnCours() {
  const formRef = useRef<HTMLFormElement>(null);
  const [modifie, setModifie] = useState(false);

  return {
    /** À poser sur le <form> : `reset()` a besoin de l'élément. */
    formRef,
    /** Vrai dès qu'un champ a changé, faux après un enregistrement réussi. */
    modifie,
    /**
     * À poser sur `onChange` du <form>. React le déclenche à CHAQUE frappe
     * pour les champs texte, et au choix pour les listes et les cases : un
     * seul écouteur sur le formulaire couvre tous ses champs.
     */
    surSaisie: useCallback(() => setModifie(true), []),
    /** Rend au formulaire les valeurs enregistrées. Sans confirmation. */
    annuler: useCallback(() => {
      formRef.current?.reset();
      setModifie(false);
    }, []),
    /** Après un enregistrement réussi : ce qui est à l'écran fait référence. */
    enregistre: useCallback(() => setModifie(false), []),
  };
}
