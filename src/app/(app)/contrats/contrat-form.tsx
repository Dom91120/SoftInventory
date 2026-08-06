"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { ChampsMarche, MARCHE_VIDE, type ValeursMarche } from "@/components/marche-champs";
import { Card } from "@/components/ui";
import {
  createContratFicheAction,
  deleteContratFicheAction,
  updateContratFicheAction,
} from "./actions";

/** Les champs eux-mêmes vivent dans `ChampsMarche`, partagé avec l'onglet du logiciel. */
export type ContratValues = ValeursMarche;

/** Cible du bouton d'enregistrement, qui vit hors du <form> — voir `children`. */
const FORM_ID = "contrat-form";

/**
 * Fiche d'un marché : ses données propres, et elles seules. Les logiciels
 * couverts se rattachent au clic, dans leur propre carte (`children`), hors de
 * ce formulaire — un lien n'est pas un champ.
 *
 * `id` absent = création (redirige vers la fiche créée, où l'on rattache). Le
 * lecteur reçoit `readOnly` : champs désactivés, aucun bouton — la protection
 * réelle reste dans les server actions (requireRole admin).
 */
export function ContratForm({
  id,
  values = MARCHE_VIDE,
  editeurs,
  readOnly = false,
  children,
}: {
  id?: number;
  values?: ContratValues;
  /** Annuaire des sociétés, pour désigner le fournisseur. */
  editeurs: Array<{ id: number; nom: string }>;
  readOnly?: boolean;
  /** Logiciels couverts et pièces, entre le formulaire et la ligne d'actions. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        id === undefined
          ? await createContratFicheAction(form)
          : await updateContratFicheAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/contrats/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function supprimer() {
    if (id === undefined) return;
    if (
      !window.confirm(
        "Supprimer ce marché ?\n\nSes pièces et leurs fichiers seront supprimés aussi. Les logiciels couverts, eux, ne sont pas touchés.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteContratFicheAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/contrats");
      router.refresh();
    });
  }

  const dis = readOnly || pending;

  return (
    <div className="space-y-3">
      <form id={FORM_ID} onSubmit={submit} className="space-y-3">
        <Card title="Marché">
          <ChampsMarche values={values} editeurs={editeurs} disabled={dis} />
        </Card>
      </form>

      {children}

      {error ? <p className="alert-error">{error}</p> : null}
      {saved ? <p className="alert-success">Marché enregistré.</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          <button type="submit" form={FORM_ID} disabled={pending} className="btn-primary">
            {pending ? "Enregistrement…" : id === undefined ? "Créer le marché" : "Enregistrer"}
          </button>
          {id !== undefined ? (
            <button type="button" onClick={supprimer} disabled={pending} className="btn-danger">
              Supprimer
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
