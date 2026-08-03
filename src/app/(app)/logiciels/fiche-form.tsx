"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { LIBELLES } from "@/schemas/logiciel";
import { createLogicielAction, deleteLogicielAction, updateLogicielAction } from "./actions";

export type Option = { id: number; label: string };

export type FicheValues = {
  nom: string;
  description: string;
  editeurId: string;
  developpementInterne: boolean;
  technologieId: string;
  criticiteId: string;
  hebergement: string;
  typeSource: string;
  statut: string;
  versionInstallee: string;
  url: string;
  dateMiseEnService: string; // AAAA-MM-JJ ou ""
  authentification: string;
  nbUtilisateurs: string;
  nbMaxUtilisateurs: string;
  referentMetier: string;
  referentTechnique: string;
  coutAnnuel: string;
  finContratLe: string;
  notes: string;
};

export const FICHE_VIDE: FicheValues = {
  nom: "",
  description: "",
  editeurId: "",
  developpementInterne: false,
  technologieId: "",
  criticiteId: "",
  hebergement: "on_premise",
  typeSource: "proprietaire",
  statut: "production",
  versionInstallee: "",
  url: "",
  dateMiseEnService: "",
  authentification: "locale",
  nbUtilisateurs: "",
  nbMaxUtilisateurs: "",
  referentMetier: "",
  referentTechnique: "",
  coutAnnuel: "",
  finContratLe: "",
  notes: "",
};

function Select({
  name,
  value,
  options,
  disabled,
  aucun,
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  aucun?: string;
}) {
  return (
    <select name={name} id={name} defaultValue={value} disabled={disabled} className="input">
      {aucun !== undefined ? <option value="">{aucun}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const enumOptions = (libelles: Record<string, string>) =>
  Object.entries(libelles).map(([value, label]) => ({ value, label }));

/**
 * Fiche principale d'un logiciel (onglet Synthèse). `id` absent = création
 * (redirige vers la fiche créée). `readOnly` pour le lecteur — la protection
 * réelle reste dans les server actions.
 */
export function FicheForm({
  id,
  values = FICHE_VIDE,
  editeurs,
  technologies,
  criticites,
  statuts,
  nbPiecesJointes = 0,
  readOnly = false,
}: {
  id?: number;
  values?: FicheValues;
  editeurs: Option[];
  technologies: Option[];
  criticites: Option[];
  /** Statuts du référentiel : la clé est envoyée, le libellé est affiché. */
  statuts: Array<{ cle: string; label: string }>;
  /**
   * Pièces jointes qu'emporterait la suppression : celles de la fiche, de ses
   * contrats et de ses devis. Tant qu'il y en a, le bouton Supprimer reste
   * grisé — la cascade PostgreSQL effacerait les lignes `documents` sans
   * retirer les fichiers du disque. L'action serveur applique la même règle.
   */
  nbPiecesJointes?: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Coché, l'éditeur n'a plus lieu d'être : la liste se neutralise aussitôt.
  const [interne, setInterne] = useState(values.developpementInterne);
  const dis = readOnly || pending;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        id === undefined ? await createLogicielAction(form) : await updateLogicielAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/logiciels/${res.id}`);
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
        `Supprimer « ${values.nom} » de l'inventaire ?\nSes contrats, devis, tâches et liaisons seront supprimés aussi.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteLogicielAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/logiciels");
      router.refresh();
    });
  }

  const refOptions = (list: Option[]) => list.map((o) => ({ value: String(o.id), label: o.label }));

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="Identité">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du logiciel" htmlFor="nom" required>
            <input
              id="nom"
              name="nom"
              defaultValue={values.nom}
              required
              disabled={dis}
              className="input"
            />
          </Field>
          <Field label="Éditeur / fournisseur" htmlFor="editeurId">
            <Select
              name="editeurId"
              value={values.editeurId}
              options={refOptions(editeurs)}
              disabled={dis || interne}
              aucun="— aucun —"
            />
            {/* Fait maison : il n'y a pas d'éditeur à désigner. La liste est
                donc neutralisée, et le champ part vide à l'enregistrement —
                un select désactivé n'est pas soumis. */}
            <label className="mt-2 flex items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                name="developpementInterne"
                checked={interne}
                onChange={(e) => setInterne(e.target.checked)}
                disabled={dis}
                className="h-4 w-4 accent-(--color-accent)"
              />
              Développement interne
            </label>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descriptif" htmlFor="description">
              <textarea
                id="description"
                name="description"
                defaultValue={values.description}
                disabled={dis}
                rows={3}
                className="input"
                placeholder="À quoi sert ce logiciel, pour qui…"
              />
            </Field>
          </div>
          <Field label="Statut" htmlFor="statut">
            <Select
              name="statut"
              value={values.statut}
              options={statuts.map((s) => ({ value: s.cle, label: s.label }))}
              disabled={dis}
            />
          </Field>
          <Field label="Criticité" htmlFor="criticiteId">
            <Select
              name="criticiteId"
              value={values.criticiteId}
              options={refOptions(criticites)}
              disabled={dis}
              aucun="— non évaluée —"
            />
          </Field>
        </div>
      </Card>

      <Card title="Technique">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hébergement" htmlFor="hebergement">
            <Select
              name="hebergement"
              value={values.hebergement}
              options={enumOptions(LIBELLES.hebergement)}
              disabled={dis}
            />
          </Field>
          <Field label="Technologie" htmlFor="technologieId">
            <Select
              name="technologieId"
              value={values.technologieId}
              options={refOptions(technologies)}
              disabled={dis}
              aucun="— non renseignée —"
            />
          </Field>
          <Field label="Open source / propriétaire" htmlFor="typeSource">
            <Select
              name="typeSource"
              value={values.typeSource}
              options={enumOptions(LIBELLES.typeSource)}
              disabled={dis}
            />
          </Field>
          <Field label="Authentification" htmlFor="authentification">
            <Select
              name="authentification"
              value={values.authentification}
              options={enumOptions(LIBELLES.authentification)}
              disabled={dis}
            />
          </Field>
          <Field label="Version installée" htmlFor="versionInstallee">
            <input
              id="versionInstallee"
              name="versionInstallee"
              defaultValue={values.versionInstallee}
              disabled={dis}
              className="input"
            />
          </Field>
          <Field label="Date de mise en service" htmlFor="dateMiseEnService">
            <input
              id="dateMiseEnService"
              name="dateMiseEnService"
              type="date"
              defaultValue={values.dateMiseEnService}
              disabled={dis}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="URL de l'application"
              htmlFor="url"
              hint="Lien direct vers le produit quand il est accessible en mode web."
            >
              <input
                id="url"
                name="url"
                type="url"
                defaultValue={values.url}
                disabled={dis}
                className="input"
                placeholder="https://…"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Usage et coûts">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre d'utilisateurs réels"
            htmlFor="nbUtilisateurs"
            hint="Vide = pas encore compté, à distinguer de zéro utilisateur."
          >
            <input
              id="nbUtilisateurs"
              name="nbUtilisateurs"
              type="number"
              min={0}
              defaultValue={values.nbUtilisateurs}
              disabled={dis}
              className="input"
            />
          </Field>
          <Field
            label="Utilisateurs max"
            htmlFor="nbMaxUtilisateurs"
            hint="Plafond prévu au contrat. Vide = illimité ; au-delà, la colonne « Plafond » de la liste passe à « Dépassé »."
          >
            <input
              id="nbMaxUtilisateurs"
              name="nbMaxUtilisateurs"
              type="number"
              min={0}
              defaultValue={values.nbMaxUtilisateurs}
              disabled={dis}
              className="input"
            />
          </Field>
          <Field label="Coût annuel (€)" htmlFor="coutAnnuel" hint="Maintenance ou abonnement.">
            <input
              id="coutAnnuel"
              name="coutAnnuel"
              inputMode="decimal"
              defaultValue={values.coutAnnuel}
              disabled={dis}
              className="input"
              placeholder="Ex. 4500"
            />
          </Field>
          <Field label="Référent métier" htmlFor="referentMetier">
            <input
              id="referentMetier"
              name="referentMetier"
              defaultValue={values.referentMetier}
              disabled={dis}
              className="input"
            />
          </Field>
          <Field label="Référent technique" htmlFor="referentTechnique">
            <input
              id="referentTechnique"
              name="referentTechnique"
              defaultValue={values.referentTechnique}
              disabled={dis}
              className="input"
            />
          </Field>
          <Field
            label="Fin de contrat / marché"
            htmlFor="finContratLe"
            hint="Déclenche un rappel avant l'échéance (délai réglable en admin)."
          >
            <input
              id="finContratLe"
              name="finContratLe"
              type="date"
              defaultValue={values.finContratLe}
              disabled={dis}
              className="input"
            />
          </Field>
        </div>
      </Card>

      <Card title="Notes">
        <textarea
          name="notes"
          defaultValue={values.notes}
          disabled={dis}
          rows={4}
          className="input"
          placeholder="Historique, particularités, points de vigilance…"
        />
      </Card>

      {error ? <p className="alert-error">{error}</p> : null}
      {saved ? <p className="alert-success">Fiche enregistrée.</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Enregistrement…" : id === undefined ? "Créer le logiciel" : "Enregistrer"}
          </button>
          {id !== undefined ? (
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
          ) : null}
        </div>
      )}
    </form>
  );
}
