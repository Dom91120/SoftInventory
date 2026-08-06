"use client";

import { Field } from "@/components/ui";

/**
 * Les champs d'un marché, partagés par les DEUX écrans qui le saisissent : sa
 * fiche et l'onglet Contrats/Marchés d'un logiciel.
 *
 * Ce module porte la GRILLE et les LIBELLÉS ; chaque écran garde son habillage
 * et ses boutons — une carte de page ici, un encadré dans la ligne d'un marché
 * là. C'est ce qui évite que les deux divergent : une phrase d'aide corrigée
 * d'un côté l'était rarement de l'autre, et les deux écrans ont fini par
 * affirmer l'inverse l'un de l'autre sur la date de fin.
 */

export type ValeursMarche = {
  referenceMarche: string;
  libelle: string;
  fournisseurId: string;
  montantAnnuel: string;
  montantMaxi: string;
  montantTotal: string;
  dateDebut: string;
  dateFin: string;
  notes: string;
};

export const MARCHE_VIDE: ValeursMarche = {
  referenceMarche: "",
  libelle: "",
  fournisseurId: "",
  montantAnnuel: "",
  montantMaxi: "",
  montantTotal: "",
  dateDebut: "",
  dateFin: "",
  notes: "",
};

export function ChampsMarche({
  values = MARCHE_VIDE,
  editeurs,
  optionFournisseurVide = "— non précisé —",
  disabled,
}: {
  values?: ValeursMarche;
  /** Annuaire des sociétés, pour désigner le fournisseur. */
  editeurs: Array<{ id: number; nom: string }>;
  /**
   * Ce que veut dire un fournisseur VIDE. « — non précisé — » sur la fiche du
   * marché, qui ne connaît aucun logiciel ; « — l'éditeur du logiciel (X) — »
   * dans l'onglet d'un logiciel, où le vide a ce sens précis.
   */
  optionFournisseurVide?: string;
  disabled: boolean;
}) {
  return (
    <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
      <Field label="Référence marché/contrat" htmlFor="referenceMarche">
        <input
          id="referenceMarche"
          name="referenceMarche"
          defaultValue={values.referenceMarche}
          disabled={disabled}
          className="input"
        />
      </Field>
      <Field label="Libellé" htmlFor="libelle">
        <input
          id="libelle"
          name="libelle"
          placeholder="Ex. marché 2024-12, pack 50 postes"
          defaultValue={values.libelle}
          disabled={disabled}
          className="input"
        />
      </Field>
      <Field label="Fournisseur" htmlFor="fournisseurId">
        <select
          id="fournisseurId"
          name="fournisseurId"
          defaultValue={values.fournisseurId}
          disabled={disabled}
          className="input"
        >
          <option value="">{optionFournisseurVide}</option>
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
          disabled={disabled}
          className="input"
        />
      </Field>
      <Field label="Maximum annuel (€)" htmlFor="montantMaxi">
        <input
          id="montantMaxi"
          name="montantMaxi"
          inputMode="decimal"
          defaultValue={values.montantMaxi}
          disabled={disabled}
          className="input"
        />
      </Field>
      <Field label="Montant total du marché (€)" htmlFor="montantTotal">
        <input
          id="montantTotal"
          name="montantTotal"
          inputMode="decimal"
          defaultValue={values.montantTotal}
          disabled={disabled}
          className="input"
        />
      </Field>

      <Field label="Date de début" htmlFor="dateDebut" hint="Prise d'effet du marché.">
        <input
          id="dateDebut"
          name="dateDebut"
          type="date"
          defaultValue={values.dateDebut}
          disabled={disabled}
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
          disabled={disabled}
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
            disabled={disabled}
            rows={2}
            className="input"
          />
        </Field>
      </div>
    </div>
  );
}
