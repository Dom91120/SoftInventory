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
  /**
   * Ce qu'est l'acte : "marche" ou "contrat". "" pour une ligne reprise de
   * l'historique, que la liste pose alors sur « Marché » — elle n'offre pas de
   * troisième choix.
   */
  nature: string;
  referenceMarche: string;
  libelle: string;
  fournisseurId: string;
  montantAnnuel: string;
  montantMaxi: string;
  montantTotal: string;
  dateDebut: string;
  dateFin: string;
  /** Durée ferme, en années : "1" à "4", ou "" si l'acte n'a pas été dépouillé. */
  dureeAnnees: string;
  /** Reconductions prévues : "0" à "3". "0" est une réponse, "" n'en est pas une. */
  renouvellements: string;
  notes: string;
};

export const MARCHE_VIDE: ValeursMarche = {
  nature: "",
  referenceMarche: "",
  libelle: "",
  fournisseurId: "",
  montantAnnuel: "",
  montantMaxi: "",
  montantTotal: "",
  dateDebut: "",
  dateFin: "",
  dureeAnnees: "",
  renouvellements: "",
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
      {/* La nature ouvre la ligne, à gauche de la référence et dans SA colonne :
          l'acte se nomme avant de se numéroter. Largeur fixe pour la liste,
          contre le `w-full` de `.input` ; la référence prend le reste, elle en
          a davantage besoin. */}
      <div className="flex items-end gap-3">
        <Field label="Nature" htmlFor="nature">
          {/* Deux choix, pas de « — » : un acte est l'un ou l'autre, il n'y a
              pas de troisième état à proposer. Les lignes reprises de
              l'historique n'ont rien en base ; la liste se pose alors sur
              « Marché », le cas de loin le plus fréquent, et l'enregistrement
              suivant l'inscrit. */}
          <select
            id="nature"
            name="nature"
            defaultValue={values.nature || "marche"}
            disabled={disabled}
            className="input w-[100px]"
          >
            <option value="marche">Marché</option>
            <option value="contrat">Contrat</option>
          </select>
        </Field>
        <div className="min-w-0 flex-1">
          {/* « Référence » seule : la liste d'à côté dit déjà si c'est un
              marché ou un contrat, et le libellé entier ne tenait plus dans la
              colonne une fois la nature posée devant. */}
          <Field label="Référence" htmlFor="referenceMarche">
            <input
              id="referenceMarche"
              name="referenceMarche"
              defaultValue={values.referenceMarche}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
      </div>
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
      <Field label="Date de fin" htmlFor="dateFin" hint="Cette date déclenche le rappel.">
        <input
          id="dateFin"
          name="dateFin"
          type="date"
          defaultValue={values.dateFin}
          disabled={disabled}
          className="input"
        />
      </Field>
      {/* Le troisième tiers de la ligne des dates, resté vide jusqu'ici. La
          durée ferme et les reconductions se lisent AVEC la période, pas
          ailleurs : elles disent ce que « du … au … » ne dit pas — l'acte
          engage n années, et prévoit de se reconduire n fois. Les deux tiennent
          dans une seule colonne, la liste prenant la place qui reste et le
          compteur la sienne. */}
      {/* `self-start` : la grille aligne ses cellules par le BAS, et les deux
          dates portent une aide sous leur champ. Sans cela, cette colonne
          descendrait au niveau de ces aides au lieu de s'aligner sur les
          champs eux-mêmes. */}
      <div className="flex items-end gap-3 self-start">
        <Field label="Durée" htmlFor="dureeAnnees">
          {/* Largeur fixe, contre le `w-full` de `.input` : « 4 ans » et sa
              flèche tiennent dans 100 px, et la liste garde la même largeur
              quelle que soit l'option choisie — elle ne se met pas à respirer
              au fil des sélections. */}
          <select
            id="dureeAnnees"
            name="dureeAnnees"
            defaultValue={values.dureeAnnees}
            disabled={disabled}
            className="input w-[100px]"
          >
            <option value="">—</option>
            <option value="1">1 an</option>
            <option value="2">2 ans</option>
            <option value="3">3 ans</option>
            <option value="4">4 ans</option>
          </select>
        </Field>
        <Field label="Renouvelable" htmlFor="renouvellements">
          <div className="flex items-center gap-2">
            <input
              id="renouvellements"
              name="renouvellements"
              type="number"
              min={0}
              max={3}
              step={1}
              defaultValue={values.renouvellements}
              disabled={disabled}
              className="input w-16"
            />
            <span className="text-sm text-muted">fois</span>
          </div>
        </Field>
      </div>

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
