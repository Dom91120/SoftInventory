"use client";

import { Check } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
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
  const saisie = useSaisieEnCours();

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. La laisser à l'écran, c'est laisser croire, au geste
   *  suivant, qu'elle parle de celui-là.
   *
   *  `state` ne dit que le dernier résultat, et le redit à l'identique d'un
   *  enregistrement au suivant : c'est le nouvel objet rendu par l'action qui
   *  relance l'effet, donc la coche, à chaque succès. Le même passage fait de
   *  ce qui est à l'écran la nouvelle référence de la saisie. */
  useEffect(() => {
    if (!state?.ok) return;
    setSaved(true);
    saisie.enregistre();
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [state, saisie.enregistre]);

  return (
    <form ref={saisie.formRef} action={action} onChange={saisie.surSaisie} className="space-y-3">
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
        {/* « Enregistrer » reste offert en permanence : cette carte n'est qu'une
            des deux de la page, et la faire changer de bouton selon l'état de sa
            saisie la ferait sautiller à côté de sa voisine, qui ne bouge pas.
            « Annuler » ne paraît que lorsqu'il y a quelque chose à annuler.

            Partir ne se décide pas ici mais sous les deux cartes : le geste ne
            porte pas plus sur le profil que sur le mot de passe. */}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saisie.modifie ? (
          <button type="button" onClick={saisie.annuler} disabled={pending} className="btn-warn">
            Annuler
          </button>
        ) : null}
        {/* La confirmation se range à la suite des boutons, là où le regard
            revient après le clic — plutôt qu'au-dessus, où elle les pousse. */}
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
