"use client";

import { Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type CategorieOption,
  type DocumentRow,
  DocumentsPanel,
} from "@/components/documents-panel";
import { Card, EmptyState, Field } from "@/components/ui";
import { formatEuros } from "@/lib/format";
import { LIBELLES } from "@/schemas/logiciel";
import { createContratAction, deleteContratAction, updateContratAction } from "../actions";

export type ContratRow = {
  id: number;
  type: string;
  libelle: string;
  /** Société avec qui on contractualise ; "" = l'éditeur du logiciel. */
  fournisseurId: string;
  fournisseurNom: string | null;
  coutAnnuel: string; // Decimal sérialisé ("" si null)
  dateRenouvellement: string; // AAAA-MM-JJ ou ""
  referenceMarche: string;
  notes: string;
  /** Décision municipale, contrat signé… rattachés à CETTE ligne de contrat. */
  documents: DocumentRow[];
};

/**
 * Onglet Contrats : lignes de contrat du logiciel. Un formulaire unique sert
 * à l'ajout ET à l'édition (bouton crayon → pré-rempli).
 *
 * Le plafond d'utilisateurs se saisit dans l'onglet Synthèse (il appartient au
 * logiciel) ; on le reçoit ici pour garder l'alerte de dépassement devant les
 * contrats, seul endroit où l'on peut la régulariser.
 */
export function ContratsPanel({
  logicielId,
  contrats,
  categories,
  editeurs,
  editeurDuLogiciel,
  nbUtilisateurs,
  nbMaxUtilisateurs,
  readOnly,
}: {
  logicielId: number;
  contrats: ContratRow[];
  categories: CategorieOption[];
  /** Annuaire des sociétés, pour désigner un revendeur. */
  editeurs: Array<{ id: number; nom: string }>;
  /** Éditeur du logiciel : fournisseur par défaut quand le contrat n'en nomme pas. */
  editeurDuLogiciel: string | null;
  nbUtilisateurs: number | null;
  nbMaxUtilisateurs: number | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<ContratRow | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  // Contrat sélectionné, dont les pièces s'affichent sous le tableau. Il y en a
  // TOUJOURS un tant qu'il existe une ligne : le repli sur la première couvre
  // le premier affichage comme la disparition de la ligne choisie (suppression),
  // ce qui évite un panneau qui s'escamote tout seul.
  const [docsDe, setDocsDe] = useState<number | null>(null);
  const contratOuvert = contrats.find((c) => c.id === docsDe) ?? contrats[0] ?? null;

  // Tant qu'aucune ligne ne nomme de revendeur, la colonne ne contient que
  // l'éditeur du logiciel : autant que l'en-tête le dise. Dès qu'un revendeur
  // apparaît, elle mélange les deux et reprend le titre générique.
  const colonneFournisseur = contrats.some((c) => c.fournisseurNom) ? "Fournisseur" : "Éditeur";

  // Utilisateurs non comptés : rien à comparer, donc pas d'alerte.
  const depassement =
    nbUtilisateurs !== null && nbMaxUtilisateurs !== null && nbUtilisateurs > nbMaxUtilisateurs;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = enEdition
        ? await updateContratAction(enEdition.id, form)
        : await createContratAction(logicielId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEnEdition(null);
      setFormVisible(false);
      router.refresh();
    });
  }

  function supprimer(l: ContratRow) {
    if (
      !window.confirm(
        `Supprimer le contrat « ${l.libelle || LIBELLES.typeContrat[l.type as keyof typeof LIBELLES.typeContrat]} » ?`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContratAction(l.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const cle = enEdition ? `edit-${enEdition.id}` : "new";

  /**
   * Supprimer un contrat efface ses pièces par CASCADE PostgreSQL, qui ne
   * retire pas les fichiers du disque : tant qu'une pièce y pend, la corbeille
   * reste grisée. L'action serveur applique la même règle.
   */
  const libellePieces = (n: number) => (n === 1 ? "1 pièce jointe" : `${n} pièces jointes`);

  return (
    <div className="space-y-6">
      {error ? <p className="alert-error">{error}</p> : null}

      {depassement ? (
        <div className="alert-danger">
          <strong className="text-danger-text">Plafond dépassé :</strong>{" "}
          <span className="text-muted">
            {nbUtilisateurs} utilisateurs réels pour {nbMaxUtilisateurs} prévus au contrat.
            Régularisez à la prochaine échéance.
          </span>
        </div>
      ) : null}

      <Card
        title="Contrats"
        actions={
          readOnly ? undefined : (
            <button
              type="button"
              className="btn-secondary !py-1.5"
              onClick={() => {
                setEnEdition(null);
                setFormVisible((v) => !v);
              }}
            >
              {formVisible && !enEdition ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {formVisible && !enEdition ? "Fermer" : "Ajouter"}
            </button>
          )
        }
      >
        {contrats.length === 0 ? (
          <EmptyState>Aucun contrat enregistré pour ce logiciel.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>{colonneFournisseur}</th>
                  <th>Type</th>
                  <th className="text-right">Coût annuel</th>
                  <th>Renouvellement</th>
                  <th>Réf. marché</th>
                  <th className="w-24">Pièces</th>
                  {readOnly ? null : <th className="w-20" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {contrats.map((l) => (
                  // Toute la ligne sélectionne — le trombone n'est qu'un des
                  // points de clic. Clavier compris : la ligne est focalisable
                  // et répond à Entrée comme à Espace.
                  <tr
                    key={l.id}
                    tabIndex={0}
                    aria-selected={contratOuvert?.id === l.id}
                    className={`cursor-pointer ${contratOuvert?.id === l.id ? "bg-inset" : ""}`}
                    onClick={() => setDocsDe(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDocsDe(l.id);
                      }
                    }}
                  >
                    <td className="font-medium text-strong">{l.libelle || "—"}</td>
                    <td>
                      {/* Sans fournisseur nommé, on affiche l'éditeur du
                          logiciel : c'est bien la valeur qui s'applique, donc
                          en couleur normale. L'infobulle est là pour dire
                          qu'elle est héritée et non saisie sur ce contrat. */}
                      {l.fournisseurNom ? (
                        l.fournisseurNom
                      ) : (
                        <span title="Fournisseur non précisé : l'éditeur du logiciel">
                          {editeurDuLogiciel ?? "—"}
                        </span>
                      )}
                    </td>
                    <td>{LIBELLES.typeContrat[l.type as keyof typeof LIBELLES.typeContrat]}</td>
                    <td className="text-right tabular-nums">{formatEuros(l.coutAnnuel) ?? "—"}</td>
                    <td>{l.dateRenouvellement || "—"}</td>
                    <td className="text-xs text-muted">{l.referenceMarche || "—"}</td>
                    <td>
                      {/* Sélectionne, sans jamais désélectionner : une ligne
                          reste toujours active sous le tableau. */}
                      <button
                        type="button"
                        className={`btn-ghost !p-2 ${contratOuvert?.id === l.id ? "!text-accent" : ""}`}
                        title={
                          l.documents.length === 0
                            ? "Aucune pièce jointe — voir ce contrat"
                            : `${l.documents.length} pièce(s) jointe(s)`
                        }
                        aria-pressed={contratOuvert?.id === l.id}
                        onClick={() => setDocsDe(l.id)}
                      >
                        <Paperclip className="h-4 w-4" />
                        <span className="tabular-nums">{l.documents.length}</span>
                      </button>
                    </td>
                    {readOnly ? null : (
                      <td>
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-ghost !p-2"
                            title="Modifier"
                            disabled={pending}
                            onClick={() => {
                              setEnEdition(l);
                              setFormVisible(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !p-2 hover:!text-danger"
                            title={
                              l.documents.length > 0
                                ? `Suppression impossible : ${libellePieces(l.documents.length)}, à retirer d'abord.`
                                : "Supprimer"
                            }
                            disabled={pending || l.documents.length > 0}
                            onClick={() => supprimer(l)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {contratOuvert ? (
        <DocumentsPanel
          key={contratOuvert.id}
          titre={`Pièces du contrat « ${contratOuvert.libelle || contratOuvert.referenceMarche || "sans libellé"} »`}
          parent={{ contratId: contratOuvert.id }}
          readOnly={readOnly}
          categories={categories}
          documents={contratOuvert.documents}
        />
      ) : null}

      {formVisible && !readOnly ? (
        <Card title={enEdition ? "Modifier le contrat" : "Nouveau contrat"}>
          {/* key force la réinitialisation des defaultValue quand la cible change */}
          <form key={cle} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Libellé" htmlFor="libelle">
              <input
                id="libelle"
                name="libelle"
                placeholder="Ex. marché 2024-12, pack 50 postes"
                defaultValue={enEdition?.libelle ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field
              label="Fournisseur"
              htmlFor="fournisseurId"
              hint="La société avec qui on contractualise. Vide = l'éditeur du logiciel ; à renseigner quand c'est un revendeur."
            >
              <select
                id="fournisseurId"
                name="fournisseurId"
                defaultValue={enEdition?.fournisseurId ?? ""}
                disabled={pending}
                className="input"
              >
                <option value="">
                  {editeurDuLogiciel
                    ? `— l'éditeur du logiciel (${editeurDuLogiciel}) —`
                    : "— non précisé —"}
                </option>
                {editeurs.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type" htmlFor="type">
              <select
                id="type"
                name="type"
                defaultValue={enEdition?.type ?? "abonnement"}
                disabled={pending}
                className="input"
              >
                {Object.entries(LIBELLES.typeContrat).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Coût annuel (€)" htmlFor="coutAnnuel">
              <input
                id="coutAnnuel"
                name="coutAnnuel"
                inputMode="decimal"
                defaultValue={enEdition?.coutAnnuel ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field
              label="Date de renouvellement"
              htmlFor="dateRenouvellement"
              hint="Déclenche un rappel avant l'échéance."
            >
              <input
                id="dateRenouvellement"
                name="dateRenouvellement"
                type="date"
                defaultValue={enEdition?.dateRenouvellement ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Référence de marché" htmlFor="referenceMarche">
              <input
                id="referenceMarche"
                name="referenceMarche"
                defaultValue={enEdition?.referenceMarche ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="notes">
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  defaultValue={enEdition?.notes ?? ""}
                  disabled={pending}
                  className="input"
                />
              </Field>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : enEdition ? "Enregistrer" : "Ajouter le contrat"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => {
                  setEnEdition(null);
                  setFormVisible(false);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
