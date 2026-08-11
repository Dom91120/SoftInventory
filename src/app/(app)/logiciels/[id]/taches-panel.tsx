"use client";

import { Check, ChevronDown, Pencil, Plus, SquarePen, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  completerTacheAction,
  createTacheAction,
  deleteTacheAction,
  updateTacheAction,
} from "@/app/(app)/taches/actions";
import { useConfirmation } from "@/components/confirmation";
import { ModaleTache } from "@/components/modale-tache";
import { Card, EmptyState, Field } from "@/components/ui";
import { LIBELLES_TACHE } from "@/schemas/tache";

export type TacheRow = {
  id: number;
  titre: string;
  description: string;
  typeTacheId: string;
  typeTacheLabel: string | null;
  periodicite: string;
  moisPersonnalises: string;
  prochaineEcheance: string; // AAAA-MM-JJ
  statut: string;
  assigneUserId: string;
  assigneLabel: string; // affichage (compte ou libre)
  assigneLibre: string;
  rappelJoursAvant: string;
  echeanceBadge: ReactNode; // rendu côté serveur (EcheanceBadge)
  executions: Array<{
    id: number;
    faitLe: string;
    echeancePrevue: string;
    par: string;
    commentaire: string;
  }>;
};

export type UserOption = { id: string; label: string };
export type TypeOption = { id: number; label: string };

/**
 * Onglet Tâches d'un logiciel : liste (badge d'échéance, assigné, périodicité),
 * complétion avec commentaire, historique replié, formulaire d'ajout/édition.
 */
export function TachesPanel({
  logicielId,
  taches,
  types,
  users,
  readOnly,
}: {
  logicielId: number;
  taches: TacheRow[];
  types: TypeOption[];
  users: UserOption[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<TacheRow | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [completion, setCompletion] = useState<TacheRow | null>(null);
  /** Tâche dont on lit la fiche, en modale — voir n'est pas modifier. */
  const [detail, setDetail] = useState<TacheRow | null>(null);

  /**
   * Interrupteur d'écriture, ÉTEINT d'office — le même que les mises en
   * concurrence, et pour la même raison : cet onglet n'a rien à enregistrer,
   * chacun de ses gestes s'applique au clic. Marquer une tâche faite avance son
   * échéance, la supprimer emporte son historique d'exécutions ; ni l'un ni
   * l'autre ne se rattrape. Le crayon donne le droit de toucher, un second clic
   * le retire, sans coche ni croix.
   */
  const [modeEdition, setModeEdition] = useState(false);
  /** Vrai quand rien ne doit pouvoir être touché — lecteur, ou crayon éteint. */
  const fige = readOnly || !modeEdition;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else {
        onOk?.();
        router.refresh();
      }
    });
  }

  function submitTache(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(
      () =>
        enEdition ? updateTacheAction(enEdition.id, form) : createTacheAction(logicielId, form),
      () => {
        setEnEdition(null);
        setFormVisible(false);
      },
    );
  }

  function submitCompletion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!completion) return;
    const form = new FormData(e.currentTarget);
    run(
      () => completerTacheAction(completion.id, form),
      () => setCompletion(null),
    );
  }

  async function supprimer(t: TacheRow) {
    const ok = await confirmer({
      question: `Supprimer la tâche « ${t.titre} » ?`,
      detail: "Son historique d'exécutions part avec elle.",
    });
    if (ok) run(() => deleteTacheAction(t.id));
  }

  return (
    <div className="space-y-3">
      {error ? <p className="alert-error">{error}</p> : null}

      <Card
        title="Tâches récurrentes"
        actions={
          readOnly ? undefined : (
            <>
              {/* Le bouton d'ajout ne paraît qu'une fois le droit donné : offert
                  sous le crayon éteint, il aurait ouvert un formulaire dans un
                  onglet qui se dit en lecture. */}
              {modeEdition ? (
                <button
                  type="button"
                  className="btn-secondary !px-2.5 !py-1 !text-xs"
                  onClick={() => {
                    setEnEdition(null);
                    setCompletion(null);
                    setFormVisible((v) => !v);
                  }}
                >
                  {formVisible && !enEdition ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {formVisible && !enEdition ? "Fermer" : "Ajouter"}
                </button>
              ) : null}
              {/* Éteindre referme ce qui était ouvert : un formulaire resté à
                  l'écran sans son bouton d'ajout n'aurait plus de sens. */}
              <button
                type="button"
                onClick={() => {
                  if (modeEdition) {
                    setFormVisible(false);
                    setEnEdition(null);
                    setCompletion(null);
                  }
                  setModeEdition(!modeEdition);
                }}
                disabled={pending}
                aria-pressed={modeEdition}
                title={modeEdition ? "Fermer la modification" : "Modifier les tâches"}
                aria-label={modeEdition ? "Fermer la modification" : "Modifier les tâches"}
                className={`btn-ghost !p-2 ${modeEdition ? "!text-accent" : "hover:!text-accent"}`}
              >
                <SquarePen className="h-4 w-4" />
              </button>
            </>
          )
        }
      >
        {taches.length === 0 ? (
          <EmptyState>
            Aucune tâche : mises à jour, renouvellements, purges, revues de comptes, certificats…
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {taches.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {/* Le titre OUVRE LA FICHE de la tâche, en lecture : voir
                        n'est pas modifier, et le crayon reste où il est. Offert
                        au lecteur comme à l'admin — il n'écrit rien. */}
                    <button
                      type="button"
                      className="truncate text-left font-medium text-strong hover:text-accent"
                      title={`Voir « ${t.titre} »`}
                      onClick={() => setDetail(t)}
                    >
                      {t.titre}
                    </button>
                    {t.typeTacheLabel ? (
                      <span className="badge-accent">{t.typeTacheLabel}</span>
                    ) : null}
                    {t.echeanceBadge}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {/* Même gabarit que « Ajouter » dans l'en-tête : un verbe
                        court accolé à une ligne, pas une commande de page.
                        Pleine taille, il dépassait les deux icônes voisines et
                        portait la hauteur de la rangée. */}
                    {fige || t.statut === "terminee" ? null : (
                      <button
                        type="button"
                        className="btn-secondary !px-2.5 !py-1 !text-xs"
                        disabled={pending}
                        onClick={() => {
                          setCompletion(t);
                          setFormVisible(false);
                          setEnEdition(null);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Fait
                      </button>
                    )}
                    {fige ? null : (
                      <>
                        <button
                          type="button"
                          className="btn-ghost !p-2"
                          title="Modifier"
                          disabled={pending}
                          onClick={() => {
                            setEnEdition(t);
                            setCompletion(null);
                            setFormVisible(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost !p-2 hover:!text-danger"
                          title="Supprimer"
                          disabled={pending}
                          onClick={() => supprimer(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {/* Tout ce que porte une tâche se lit ICI, sans rien ouvrir : le
                    formulaire est réservé à l'écriture, et il vit maintenant
                    derrière le crayon. Le délai de rappel y était le seul
                    renseignement qu'on ne pouvait voir qu'en modifiant. Il ne
                    paraît que s'il a été fixé sur la tâche — sinon c'est le
                    seuil global d'Administration › Messagerie qui s'applique,
                    et l'annoncer tâche par tâche répéterait la même phrase
                    partout. */}
                <div className="mt-1 text-xs text-muted">
                  {[
                    LIBELLES_TACHE.periodicite[
                      t.periodicite as keyof typeof LIBELLES_TACHE.periodicite
                    ],
                    t.assigneLabel && `assignée à ${t.assigneLabel}`,
                    t.rappelJoursAvant && `rappel ${t.rappelJoursAvant} j avant`,
                    t.description,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {t.executions.length > 0 ? (
                  <details className="group mt-2">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-faint hover:text-strong [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                      Historique ({t.executions.length})
                    </summary>
                    <ul className="mt-2 space-y-1 border-l-2 border-line pl-4 text-xs text-muted">
                      {t.executions.map((ex) => (
                        <li key={ex.id}>
                          <span className="font-medium text-body">{ex.faitLe}</span> — échéance
                          prévue {ex.echeancePrevue}
                          {ex.par ? ` · par ${ex.par}` : ""}
                          {ex.commentaire ? ` · ${ex.commentaire}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {detail ? <ModaleTache tache={detail} onFermer={() => setDetail(null)} /> : null}

      {completion ? (
        <Card title={`Marquer « ${completion.titre} » comme faite`}>
          <form onSubmit={submitCompletion} className="space-y-3">
            <Field label="Commentaire (optionnel)" htmlFor="commentaire">
              <textarea
                id="commentaire"
                name="commentaire"
                rows={2}
                className="input"
                placeholder="Version installée, anomalies rencontrées, référence de ticket…"
              />
            </Field>
            <div className="flex gap-3">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : "Confirmer"}
              </button>
              <button
                type="button"
                className="btn-warn"
                disabled={pending}
                onClick={() => setCompletion(null)}
              >
                Annuler
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {formVisible && !fige ? (
        <Card title={enEdition ? "Modifier la tâche" : "Nouvelle tâche"}>
          <form
            key={enEdition ? `edit-${enEdition.id}` : "new"}
            onSubmit={submitTache}
            className="grid gap-x-3 gap-y-2 sm:grid-cols-2"
          >
            <Field label="Titre" htmlFor="titre" required>
              <input
                id="titre"
                name="titre"
                required
                defaultValue={enEdition?.titre ?? ""}
                disabled={pending}
                className="input"
                placeholder="Ex : Mise à jour de version, purge annuelle…"
              />
            </Field>
            <Field label="Type" htmlFor="typeTacheId">
              <select
                id="typeTacheId"
                name="typeTacheId"
                defaultValue={enEdition?.typeTacheId ?? ""}
                disabled={pending}
                className="input"
              >
                <option value="">— sans type —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="description">
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={enEdition?.description ?? ""}
                  disabled={pending}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Périodicité" htmlFor="periodicite">
              <select
                id="periodicite"
                name="periodicite"
                defaultValue={enEdition?.periodicite ?? "annuelle"}
                disabled={pending}
                className="input"
              >
                {Object.entries(LIBELLES_TACHE.periodicite).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Intervalle (mois)"
              htmlFor="moisPersonnalises"
              hint="Uniquement pour la périodicité personnalisée."
            >
              <input
                id="moisPersonnalises"
                name="moisPersonnalises"
                type="number"
                min={1}
                max={120}
                defaultValue={enEdition?.moisPersonnalises ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Prochaine échéance" htmlFor="prochaineEcheance" required>
              <input
                id="prochaineEcheance"
                name="prochaineEcheance"
                type="date"
                required
                defaultValue={enEdition?.prochaineEcheance ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Statut" htmlFor="statut">
              <select
                id="statut"
                name="statut"
                defaultValue={enEdition?.statut ?? "active"}
                disabled={pending}
                className="input"
              >
                {Object.entries(LIBELLES_TACHE.statut).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assignée à (compte)" htmlFor="assigneUserId">
              <select
                id="assigneUserId"
                name="assigneUserId"
                defaultValue={enEdition?.assigneUserId ?? ""}
                disabled={pending}
                className="input"
              >
                <option value="">— personne —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Ou nom libre"
              htmlFor="assigneLibre"
              hint="Personne sans compte dans l'application (prestataire…)."
            >
              <input
                id="assigneLibre"
                name="assigneLibre"
                defaultValue={enEdition?.assigneLibre ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field
              label="Rappel (jours avant)"
              htmlFor="rappelJoursAvant"
              hint="Vide = délai global de l'application."
            >
              <input
                id="rappelJoursAvant"
                name="rappelJoursAvant"
                type="number"
                min={0}
                max={365}
                defaultValue={enEdition?.rappelJoursAvant ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : enEdition ? "Enregistrer" : "Ajouter la tâche"}
              </button>
              <button
                type="button"
                className="btn-warn"
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
