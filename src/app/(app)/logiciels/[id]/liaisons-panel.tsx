"use client";

import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { LIBELLES } from "@/schemas/logiciel";
import {
  addInterconnexionAction,
  addServeurAction,
  removeInterconnexionAction,
  removeServeurAction,
  setServicesAction,
} from "../actions";
import type { Option } from "../fiche-form";

type ServeurLie = { serveurId: number; nom: string; environnement: string };
type Interco = {
  id: number;
  direction: "sortante" | "entrante";
  autre: { id: number; nom: string };
  description: string;
};

/**
 * Onglet Liaisons : services utilisateurs (cases à cocher + enregistrement du
 * delta), serveurs d'installation (serveur + environnement) et interconnexions
 * (flux orientés avec description, affichés dans les deux sens).
 */
export function LiaisonsPanel({
  logicielId,
  services,
  servicesLies,
  serveurs,
  serveursLies,
  autresLogiciels,
  interconnexions,
  readOnly,
}: {
  logicielId: number;
  services: Option[];
  servicesLies: number[];
  serveurs: Option[];
  serveursLies: ServeurLie[];
  autresLogiciels: Option[];
  interconnexions: Interco[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [coches, setCoches] = useState<Set<number>>(new Set(servicesLies));
  const [nouveauServeur, setNouveauServeur] = useState("");
  const [nouvelEnv, setNouvelEnv] = useState("production");
  const [nouvelleCible, setNouvelleCible] = useState("");
  const [nouvelleDesc, setNouvelleDesc] = useState("");

  const dirtyServices =
    coches.size !== servicesLies.length || servicesLies.some((id) => !coches.has(id));

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

  return (
    <div className="space-y-6">
      {error ? <p className="alert-error">{error}</p> : null}

      <Card title="Services utilisateurs">
        {services.length === 0 ? (
          <p className="text-sm text-faint">
            Aucun service dans le référentiel — ajoutez-les depuis Administration › Référentiels.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-(--color-accent)"
                    checked={coches.has(s.id)}
                    disabled={readOnly || pending}
                    onChange={(e) => {
                      const next = new Set(coches);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      setCoches(next);
                    }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            {readOnly ? null : (
              <button
                type="button"
                className="btn-primary mt-4"
                disabled={pending || !dirtyServices}
                onClick={() => run(() => setServicesAction(logicielId, [...coches]))}
              >
                Enregistrer les services
              </button>
            )}
          </>
        )}
      </Card>

      <Card title="Serveurs d'installation">
        {serveursLies.length === 0 ? (
          <p className="mb-3 text-sm text-faint">Aucun serveur associé.</p>
        ) : (
          <ul className="mb-3 divide-y divide-line text-sm">
            {serveursLies.map((s) => (
              <li
                key={`${s.serveurId}-${s.environnement}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  <span className="font-medium text-strong">{s.nom}</span>
                  <span
                    className={`ml-2 ${s.environnement === "production" ? "badge-ok" : "badge-muted"}`}
                  >
                    {LIBELLES.environnement[s.environnement as keyof typeof LIBELLES.environnement]}
                  </span>
                </span>
                {readOnly ? null : (
                  <button
                    type="button"
                    className="btn-ghost !p-2 hover:!text-danger"
                    title="Retirer"
                    disabled={pending}
                    onClick={() =>
                      run(() => removeServeurAction(logicielId, s.serveurId, s.environnement))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {readOnly ? null : serveurs.length === 0 ? (
          <p className="text-sm text-faint">
            Aucun serveur dans le référentiel — ajoutez-les depuis Administration › Référentiels.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input !w-auto"
              value={nouveauServeur}
              onChange={(e) => setNouveauServeur(e.target.value)}
              disabled={pending}
              aria-label="Serveur"
            >
              <option value="">Choisir un serveur…</option>
              {serveurs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              className="input !w-auto"
              value={nouvelEnv}
              onChange={(e) => setNouvelEnv(e.target.value)}
              disabled={pending}
              aria-label="Environnement"
            >
              {Object.entries(LIBELLES.environnement).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || !nouveauServeur}
              onClick={() =>
                run(
                  () => addServeurAction(logicielId, Number(nouveauServeur), nouvelEnv),
                  () => setNouveauServeur(""),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Associer
            </button>
          </div>
        )}
      </Card>

      <Card title="Interconnexions">
        {interconnexions.length === 0 ? (
          <p className="mb-3 text-sm text-faint">
            Aucune interconnexion déclarée (échanges de données avec d'autres logiciels).
          </p>
        ) : (
          <ul className="mb-3 divide-y divide-line text-sm">
            {interconnexions.map((ix) => (
              <li key={ix.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  {ix.direction === "sortante" ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <ArrowLeft className="h-4 w-4 shrink-0 text-info" />
                  )}
                  <Link
                    href={`/logiciels/${ix.autre.id}`}
                    className="font-medium text-strong hover:text-accent"
                  >
                    {ix.autre.nom}
                  </Link>
                  {ix.description ? (
                    <span className="truncate text-xs text-muted">— {ix.description}</span>
                  ) : null}
                </span>
                {readOnly ? null : (
                  <button
                    type="button"
                    className="btn-ghost !p-2 hover:!text-danger"
                    title="Supprimer l'interconnexion"
                    disabled={pending}
                    onClick={() => run(() => removeInterconnexionAction(ix.id, logicielId))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {readOnly ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input !w-auto"
              value={nouvelleCible}
              onChange={(e) => setNouvelleCible(e.target.value)}
              disabled={pending}
              aria-label="Logiciel cible"
            >
              <option value="">Vers le logiciel…</option>
              {autresLogiciels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <input
              className="input !w-72"
              placeholder="Description du flux (ex. export paie mensuel)"
              value={nouvelleDesc}
              onChange={(e) => setNouvelleDesc(e.target.value)}
              disabled={pending}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || !nouvelleCible}
              onClick={() =>
                run(
                  () => addInterconnexionAction(logicielId, Number(nouvelleCible), nouvelleDesc),
                  () => {
                    setNouvelleCible("");
                    setNouvelleDesc("");
                  },
                )
              }
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
