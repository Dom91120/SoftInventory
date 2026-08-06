"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import {
  createContratFicheAction,
  deleteContratFicheAction,
  updateContratFicheAction,
} from "./actions";

export type ContratValues = {
  referenceMarche: string;
  libelle: string;
  fournisseurId: string;
  montantAnnuel: string;
  montantMaxi: string;
  montantTotal: string;
  dateDebut: string;
  dateFin: string;
  notes: string;
  /** Ids des logiciels couverts, en chaînes — ce que rend une case cochée. */
  logicielIds: string[];
};

const VIDE: ContratValues = {
  referenceMarche: "",
  libelle: "",
  fournisseurId: "",
  montantAnnuel: "",
  montantMaxi: "",
  montantTotal: "",
  dateDebut: "",
  dateFin: "",
  notes: "",
  logicielIds: [],
};

/** Cible du bouton d'enregistrement, qui vit hors du <form> — voir `children`. */
const FORM_ID = "contrat-form";

/**
 * Fiche d'un marché : ses données propres, puis les logiciels qu'il couvre.
 * `id` absent = création (redirige vers la fiche créée). Le lecteur reçoit
 * `readOnly` : champs désactivés, aucun bouton — la protection réelle reste
 * dans les server actions (requireRole admin).
 */
export function ContratForm({
  id,
  values = VIDE,
  editeurs,
  logiciels,
  readOnly = false,
  children,
}: {
  id?: number;
  values?: ContratValues;
  /** Annuaire des sociétés, pour désigner le fournisseur. */
  editeurs: Array<{ id: number; nom: string }>;
  /** Inventaire complet : le marché se rattache à autant de fiches qu'il couvre. */
  logiciels: Array<{ id: number; nom: string }>;
  readOnly?: boolean;
  /** Pièces du marché, posées entre le formulaire et la ligne d'actions. */
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
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
            <Field label="Référence marché/contrat" htmlFor="referenceMarche">
              <input
                id="referenceMarche"
                name="referenceMarche"
                defaultValue={values.referenceMarche}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Libellé" htmlFor="libelle">
              <input
                id="libelle"
                name="libelle"
                placeholder="Ex. marché 2024-12, pack 50 postes"
                defaultValue={values.libelle}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Fournisseur" htmlFor="fournisseurId">
              <select
                id="fournisseurId"
                name="fournisseurId"
                defaultValue={values.fournisseurId}
                disabled={dis}
                className="input"
              >
                <option value="">— non précisé —</option>
                {editeurs.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Montant annuel (€)" htmlFor="montantAnnuel">
              <input
                id="montantAnnuel"
                name="montantAnnuel"
                inputMode="decimal"
                defaultValue={values.montantAnnuel}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Maximum annuel (€)" htmlFor="montantMaxi">
              <input
                id="montantMaxi"
                name="montantMaxi"
                inputMode="decimal"
                defaultValue={values.montantMaxi}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Montant total du marché (€)" htmlFor="montantTotal">
              <input
                id="montantTotal"
                name="montantTotal"
                inputMode="decimal"
                defaultValue={values.montantTotal}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Date de début" htmlFor="dateDebut" hint="Prise d'effet du marché.">
              <input
                id="dateDebut"
                name="dateDebut"
                type="date"
                defaultValue={values.dateDebut}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field
              label="Date de fin"
              htmlFor="dateFin"
              hint="Terme du marché : CETTE date déclenche le rappel."
            >
              <input
                id="dateFin"
                name="dateFin"
                type="date"
                defaultValue={values.dateFin}
                disabled={dis}
                className="input"
              />
            </Field>
            <div />
            <div className="sm:col-span-3">
              <Field label="Notes" htmlFor="notes">
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={values.notes}
                  disabled={dis}
                  rows={2}
                  className="input"
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Un marché en couvre souvent plusieurs (UGAP, marchés « communs ») :
            d'où des cases plutôt qu'une liste à choix unique. Aucun logiciel
            coché reste permis — un marché peut précéder l'inventaire de ce
            qu'il couvre. */}
        <Card title="Logiciels couverts">
          {logiciels.length === 0 ? (
            <p className="text-sm text-faint">L'inventaire ne contient encore aucun logiciel.</p>
          ) : (
            <div className="grid gap-x-3 gap-y-1 sm:grid-cols-3">
              {logiciels.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center gap-2 text-sm text-body"
                  htmlFor={`logiciel-${l.id}`}
                >
                  <input
                    id={`logiciel-${l.id}`}
                    type="checkbox"
                    name="logicielIds"
                    value={String(l.id)}
                    defaultChecked={values.logicielIds.includes(String(l.id))}
                    disabled={dis}
                    className="h-4 w-4 shrink-0 accent-(--color-accent)"
                  />
                  <span className="truncate" title={l.nom}>
                    {l.nom}
                  </span>
                </label>
              ))}
            </div>
          )}
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
