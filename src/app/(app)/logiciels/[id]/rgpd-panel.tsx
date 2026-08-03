"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { LIBELLES } from "@/schemas/logiciel";
import { updateRgpdAction } from "../actions";

export type RgpdValues = {
  donneesPersonnelles: boolean;
  categoriesDonnees: string;
  registreRef: string;
  localisationDonnees: string;
};

/** Onglet RGPD : volet simple par logiciel (données personnelles, registre, localisation). */
export function RgpdPanel({
  logicielId,
  values,
  readOnly,
}: {
  logicielId: number;
  values: RgpdValues;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [traite, setTraite] = useState(values.donneesPersonnelles);
  const dis = readOnly || pending;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateRgpdAction(logicielId, form);
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="Données personnelles">
        <label className="flex items-center gap-3 text-sm text-body">
          <input
            type="checkbox"
            name="donneesPersonnelles"
            checked={traite}
            onChange={(e) => setTraite(e.target.checked)}
            disabled={dis}
            className="h-4 w-4 accent-(--color-accent)"
          />
          Ce logiciel traite des données personnelles
        </label>
        {traite ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Catégories de données traitées" htmlFor="categoriesDonnees">
                <textarea
                  id="categoriesDonnees"
                  name="categoriesDonnees"
                  placeholder="Ex. état civil, coordonnées, données financières, données de santé…"
                  rows={3}
                  defaultValue={values.categoriesDonnees}
                  disabled={dis}
                  className="input"
                />
              </Field>
            </div>
            <Field
              label="Référence au registre des traitements"
              htmlFor="registreRef"
              hint="Numéro ou intitulé de la fiche du registre tenue avec le DPO."
            >
              <input
                id="registreRef"
                name="registreRef"
                defaultValue={values.registreRef}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Localisation des données" htmlFor="localisationDonnees">
              <select
                id="localisationDonnees"
                name="localisationDonnees"
                defaultValue={values.localisationDonnees}
                disabled={dis}
                className="input"
              >
                {Object.entries(LIBELLES.localisationDonnees).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          // Champs conservés dans le formulaire même masqués : décocher ne doit
          // pas effacer silencieusement ce qui avait été renseigné.
          <div className="hidden">
            <input name="categoriesDonnees" defaultValue={values.categoriesDonnees} />
            <input name="registreRef" defaultValue={values.registreRef} />
            <input name="localisationDonnees" defaultValue={values.localisationDonnees} />
          </div>
        )}
      </Card>
      {error ? <p className="alert-error">{error}</p> : null}
      {saved ? <p className="alert-success">Volet RGPD enregistré.</p> : null}
      {readOnly ? null : (
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
