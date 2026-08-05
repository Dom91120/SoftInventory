"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { updateProfileAction } from "./actions";

export function ProfileForm({
  prenom,
  nom,
  tel,
  email,
}: {
  prenom: string;
  nom: string;
  tel: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <Field label="Adresse e-mail" htmlFor="email">
        <input id="email" type="email" value={email} disabled className="input" />
      </Field>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="prenom">
          <input id="prenom" name="prenom" defaultValue={prenom} className="input" />
        </Field>
        <Field label="Nom" htmlFor="nom">
          <input id="nom" name="nom" defaultValue={nom} className="input" />
        </Field>
      </div>
      <Field label="Téléphone" htmlFor="tel">
        <input id="tel" name="tel" type="tel" defaultValue={tel} className="input" />
      </Field>
      {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
      {state?.ok ? <p className="alert-success">Profil enregistré.</p> : null}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
