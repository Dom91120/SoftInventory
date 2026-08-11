"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { lireCodesAction, updateCodesAction } from "./actions";

/**
 * Les deux codes remis par l'autorité — révocation et retrait.
 *
 * Ils ne sont PAS rendus avec la page : tant que personne ne clique sur
 * « Afficher », ils ne quittent pas la base. Un secret qu'on n'a pas envoyé ne
 * traîne ni dans le HTML d'un onglet resté ouvert derrière un écran non
 * verrouillé, ni dans le cache du navigateur, ni dans une capture d'écran de
 * l'inspecteur. Le clic les demande, le bouton les remballe.
 *
 * Cette carte n'est rendue qu'aux admins, et l'action qu'elle appelle exige à
 * nouveau ce rôle : la garde vaut côté serveur, l'absence de carte n'étant
 * qu'une commodité d'affichage.
 */
export function CodesPanel({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** null = jamais demandés — l'état « fermé », qui est celui du chargement. */
  const [codes, setCodes] = useState<{ codeRevocation: string; codeRetrait: string } | null>(null);

  function afficher() {
    setError(null);
    startTransition(async () => {
      const res = await lireCodesAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCodes({ codeRevocation: res.codeRevocation, codeRetrait: res.codeRetrait });
    });
  }

  /** Masquer OUBLIE les valeurs : les garder en mémoire annulerait le geste. */
  function masquer() {
    setCodes(null);
    setSaved(false);
    setError(null);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCodesAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card
      title="Codes de l'autorité"
      hint="Réservés aux administrateurs"
      actions={
        codes === null ? (
          <button
            type="button"
            onClick={afficher}
            disabled={pending}
            className="btn-secondary !px-2.5"
            title="Afficher les codes de révocation et de retrait"
          >
            <Eye className="h-4 w-4" />
            Afficher
          </button>
        ) : (
          <button
            type="button"
            onClick={masquer}
            disabled={pending}
            className="btn-secondary !px-2.5"
            title="Masquer les codes"
          >
            <EyeOff className="h-4 w-4" />
            Masquer
          </button>
        )
      }
    >
      {codes === null ? (
        <p className="text-sm text-faint">
          Le code de <strong>révocation</strong> invalide le certificat en cas de perte, de vol ou
          de départ du titulaire ; le code de <strong>retrait</strong> sert à le récupérer et
          l'activer. Ils restent en base tant qu'on ne les demande pas.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-2">
            <Field label="Code de révocation" htmlFor="codeRevocation">
              <input
                id="codeRevocation"
                name="codeRevocation"
                defaultValue={codes.codeRevocation}
                disabled={pending}
                autoComplete="off"
                spellCheck={false}
                className="input font-mono"
              />
            </Field>
            <Field label="Code de retrait" htmlFor="codeRetrait">
              <input
                id="codeRetrait"
                name="codeRetrait"
                defaultValue={codes.codeRetrait}
                disabled={pending}
                autoComplete="off"
                spellCheck={false}
                className="input font-mono"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Enregistrement…" : "Enregistrer les codes"}
            </button>
            {saved ? (
              <span
                className="flex items-center gap-1.5 text-sm"
                style={{ color: "var(--color-ok-text)" }}
              >
                <Check className="h-4 w-4" />
                Codes enregistrés.
              </span>
            ) : null}
          </div>
        </form>
      )}
      {error ? <p className="alert-error mt-2">{error}</p> : null}
    </Card>
  );
}
