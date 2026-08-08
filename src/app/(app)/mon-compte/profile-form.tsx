"use client";

import { Check } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
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
  const [saved, setSaved] = useState(false);

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. La laisser à l'écran, c'est laisser croire, au geste
   *  suivant, qu'elle parle de celui-là.
   *
   *  `state` ne dit que le dernier résultat, et le redit à l'identique d'un
   *  enregistrement au suivant : c'est le nouvel objet rendu par l'action qui
   *  relance l'effet, donc la coche, à chaque succès. */
  useEffect(() => {
    if (!state?.ok) return;
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [state]);

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
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {/* La confirmation se range à la suite du bouton, là où le regard
            revient après le clic — plutôt qu'au-dessus, où elle le pousse. */}
        {saved ? (
          <span
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "var(--color-ok-text)" }}
          >
            <Check className="h-4 w-4" />
            Profil enregistré.
          </span>
        ) : null}
      </div>
    </form>
  );
}
