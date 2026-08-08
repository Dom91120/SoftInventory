"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { deleteLogicielAction } from "./actions";

/**
 * Suppression d'un logiciel, offerte depuis N'IMPORTE QUEL onglet de sa fiche :
 * on décide de retirer une application en lisant ses contrats ou ses tâches,
 * pas seulement sa synthèse.
 *
 * Composant partagé et non recopié par onglet : la question posée, la cascade
 * annoncée et la garde des pièces jointes doivent dire la même chose partout.
 *
 * Le refus quand des pièces pendent est une COMMODITÉ d'écran — l'action
 * serveur applique la même règle, et c'est elle qui protège réellement.
 */
export function BoutonSupprimerLogiciel({
  id,
  nom,
  nbPiecesJointes,
}: {
  id: number;
  nom: string;
  /** Documents de la fiche, de ses marchés et de ses devis, tous chemins confondus. */
  nbPiecesJointes: number;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer() {
    const ok = await confirmer({
      question: `Supprimer « ${nom} » de l'inventaire ?`,
      detail: "Ses contrats, devis, tâches et liaisons seront supprimés aussi.",
    });
    if (!ok) return;
    setErreur(null);
    startTransition(async () => {
      const res = await deleteLogicielAction(id);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      router.replace("/logiciels");
      router.refresh();
    });
  }

  // L'erreur se pose AU-DESSUS du bouton et alignée sur lui : la corbeille vit
  // au bout d'une ligne d'actions, où un bandeau pleine largeur n'a pas sa place.
  return (
    <span className="flex flex-col items-end gap-1">
      {erreur ? <span className="alert-error !py-1 text-xs">{erreur}</span> : null}
      <button
        type="button"
        onClick={supprimer}
        disabled={pending || nbPiecesJointes > 0}
        title={
          nbPiecesJointes > 0
            ? `Suppression impossible : ${nbPiecesJointes === 1 ? "1 pièce jointe" : `${nbPiecesJointes} pièces jointes`} sur cette fiche, ses contrats ou ses devis, à retirer d'abord.`
            : undefined
        }
        className="btn-danger"
      >
        Supprimer
      </button>
    </span>
  );
}
