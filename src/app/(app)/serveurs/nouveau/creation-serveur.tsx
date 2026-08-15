"use client";

import { useState } from "react";
import { type Installation, LogicielsPanel, type ReferentielsLogiciel } from "../logiciels-panel";
import { ServeurForm } from "../serveur-form";

/**
 * L'écran de création, côté client — il n'existe que pour tenir UNE liste : les
 * logiciels qu'on déclare installés sur une machine qui n'est pas encore créée.
 *
 * Ces installations ne peuvent pas s'écrire au fil de la saisie : une ligne de
 * liaison exige les deux identifiants, et la machine n'en a pas. Elles vivent
 * donc ici, entre le panneau qui les recueille et le formulaire qui les posera
 * juste après la création — on monte un serveur en disant du même geste ce
 * qu'on y met, plutôt qu'en revenant sur sa fiche une fois créée.
 */
export function CreationServeur({
  logiciels,
  referentiels,
}: {
  logiciels: Array<{ id: number; label: string }>;
  referentiels: ReferentielsLogiciel;
}) {
  const [enAttente, setEnAttente] = useState<Installation[]>([]);
  return (
    <ServeurForm
      installationsEnAttente={enAttente}
      logiciels={
        <LogicielsPanel
          key="logiciels"
          installations={enAttente}
          onChangeEnAttente={setEnAttente}
          logiciels={logiciels}
          referentiels={referentiels}
          readOnly={false}
        />
      }
    />
  );
}
