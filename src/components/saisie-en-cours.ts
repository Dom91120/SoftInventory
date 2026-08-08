"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * « La fiche diffère-t-elle de ce qui est enregistré ? », pour les trois fiches
 * qui portent Enregistrer, Annuler et Supprimer — logiciel, éditeur, marché.
 *
 * Ce qu'on en fait : tant que rien ne diffère, il n'y a rien à enregistrer, et
 * la ligne d'actions n'offre que de partir. Dès qu'un champ s'écarte de sa
 * valeur enregistrée, « Enregistrer » paraît et « Annuler » le rejoint, qui rend
 * au formulaire ce qu'il affichait. Le retour se fait sans confirmation : il ne
 * détruit que des frappes non sauvegardées.
 *
 * La question posée est bien « la valeur DIFFÈRE-t-elle », et non « un champ
 * a-t-il été touché » : taper une lettre puis l'effacer laissait sinon la fiche
 * en état modifié, proposant d'enregistrer ce qui n'avait pas bougé.
 *
 * Non contrôlé de bout en bout : les formulaires gardent leurs `defaultValue`,
 * et `reset()` du DOM les restitue telles que le serveur les a rendues. Aucun
 * état par champ à tenir, rien à réconcilier — d'où la comparaison par
 * EMPREINTE, relevée sur le formulaire entier plutôt que champ par champ.
 */
export function useSaisieEnCours() {
  const formRef = useRef<HTMLFormElement>(null);
  /** L'empreinte de référence : ce que le serveur a rendu, ou le dernier enregistrement. */
  const reference = useRef<string | null>(null);
  const [modifie, setModifie] = useState(false);

  const empreinte = useCallback(() => {
    const form = formRef.current;
    if (!form) return "";
    // Les fichiers ne se comparent pas ainsi, et aucun de ces formulaires n'en
    // porte : ils vivent dans les panneaux voisins, hors du <form>.
    return [...new FormData(form).entries()]
      .map(([cle, valeur]) => `${cle}=${typeof valeur === "string" ? valeur : ""}`)
      .join("\n");
  }, []);

  // Relevée APRÈS le premier rendu : les champs sont alors dans le document,
  // avec les valeurs par défaut que le serveur leur a données.
  useEffect(() => {
    reference.current = empreinte();
  }, [empreinte]);

  return {
    /** À poser sur le <form> : `reset()` et la lecture des champs en ont besoin. */
    formRef,
    /** Vrai tant que la saisie s'écarte de ce qui est enregistré. */
    modifie,
    /**
     * À poser sur `onChange` du <form>. React le déclenche à CHAQUE frappe pour
     * les champs texte, et au choix pour les listes et les cases : un seul
     * écouteur sur le formulaire couvre tous ses champs.
     */
    surSaisie: useCallback(() => {
      setModifie(reference.current !== null && empreinte() !== reference.current);
    }, [empreinte]),
    /** Rend au formulaire les valeurs enregistrées. Sans confirmation. */
    annuler: useCallback(() => {
      formRef.current?.reset();
      setModifie(false);
    }, []),
    /** Après un enregistrement réussi : ce qui est à l'écran fait référence. */
    enregistre: useCallback(() => {
      reference.current = empreinte();
      setModifie(false);
    }, [empreinte]),
  };
}
