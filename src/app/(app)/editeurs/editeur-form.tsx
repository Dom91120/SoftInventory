"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { createEditeurAction, deleteEditeurAction, updateEditeurAction } from "./actions";

export type EditeurValues = {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siteWeb: string;
  supportUrl: string;
  supportEmail: string;
  supportTelephone: string;
  supportHoraires: string;
  notes: string;
};

const VIDE: EditeurValues = {
  nom: "",
  adresse: "",
  codePostal: "",
  ville: "",
  telephone: "",
  email: "",
  siteWeb: "",
  supportUrl: "",
  supportEmail: "",
  supportTelephone: "",
  supportHoraires: "",
  notes: "",
};

/**
 * Formulaire de fiche éditeur, en deux cartes (coordonnées / support).
 * `id` absent = création (redirige vers la fiche créée). Le lecteur reçoit
 * `readOnly` : champs désactivés, aucun bouton — la protection réelle reste
 * dans les server actions (requireRole admin).
 */
export function EditeurForm({
  id,
  values = VIDE,
  nbPiecesJointes = 0,
  readOnly = false,
}: {
  id?: number;
  values?: EditeurValues;
  /**
   * Pièces jointes de la fiche. Tant qu'il y en a, le bouton Supprimer reste
   * grisé : la cascade PostgreSQL effacerait les lignes `documents` sans
   * retirer les fichiers du disque. L'action serveur applique la même règle.
   */
  nbPiecesJointes?: number;
  readOnly?: boolean;
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
        id === undefined ? await createEditeurAction(form) : await updateEditeurAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/editeurs/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function supprimer() {
    if (id === undefined) return;
    if (!window.confirm(`Supprimer l'éditeur « ${values.nom} » ?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteEditeurAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/editeurs");
      router.refresh();
    });
  }

  const dis = readOnly || pending;
  /**
   * `placeholder` plutôt que `hint` quand l'aide n'est qu'un exemple de format :
   * elle occupe alors la place du champ vide au lieu d'ajouter une ligne sous
   * chacun, ce qui allonge la fiche entière. `hint` reste pour ce qui doit se
   * lire même une fois le champ rempli.
   */
  const champ = (
    name: keyof EditeurValues,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string },
  ) => (
    <Field label={label} htmlFor={name} hint={opts?.hint}>
      <input
        id={name}
        name={name}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        defaultValue={values[name]}
        disabled={dis}
        className="input"
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="Coordonnées">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l'éditeur" htmlFor="nom" required>
            <input
              id="nom"
              name="nom"
              defaultValue={values.nom}
              required
              disabled={dis}
              className="input"
            />
          </Field>
          {champ("siteWeb", "Site web", { type: "url", placeholder: "https://…" })}
          {champ("adresse", "Adresse")}
          <div className="grid grid-cols-[8rem_1fr] gap-4">
            {champ("codePostal", "Code postal")}
            {champ("ville", "Ville")}
          </div>
          {champ("telephone", "Téléphone", { type: "tel" })}
          {champ("email", "E-mail", { type: "email" })}
        </div>
      </Card>

      <Card title="Support">
        <div className="grid gap-4 sm:grid-cols-2">
          {champ("supportUrl", "Portail de tickets", { type: "url", placeholder: "https://…" })}
          {champ("supportEmail", "E-mail du support", { type: "email" })}
          {champ("supportTelephone", "Téléphone du support", { type: "tel" })}
          {champ("supportHoraires", "Horaires", { placeholder: "Ex. lun-ven 9h-18h" })}
        </div>
      </Card>

      <Card title="Notes">
        <textarea
          name="notes"
          defaultValue={values.notes}
          disabled={dis}
          rows={4}
          className="input"
          placeholder="Informations libres : interlocuteurs, historique, particularités du contrat…"
        />
      </Card>

      {error ? <p className="alert-error">{error}</p> : null}
      {saved ? <p className="alert-success">Fiche enregistrée.</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Enregistrement…" : id === undefined ? "Créer l'éditeur" : "Enregistrer"}
          </button>
          {id !== undefined ? (
            <button
              type="button"
              onClick={supprimer}
              disabled={pending || nbPiecesJointes > 0}
              title={
                nbPiecesJointes > 0
                  ? `Suppression impossible : ${nbPiecesJointes === 1 ? "1 pièce jointe" : `${nbPiecesJointes} pièces jointes`} sur cette fiche, à retirer d'abord.`
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
