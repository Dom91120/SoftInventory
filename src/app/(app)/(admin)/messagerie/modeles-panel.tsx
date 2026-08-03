"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { resetTemplateAction, saveTemplateAction } from "./actions";

export type ModeleRow = {
  key: string;
  label: string;
  description: string;
  /** Contenu affiché : surcharge en base si présente, sinon défaut du code. */
  subject: string;
  html: string;
  surcharge: boolean;
};

/**
 * Éditeur des gabarits d'e-mails : sujet + HTML avec variables {{…}}.
 * « Revenir au modèle d'origine » vide la surcharge — le défaut du code
 * reprend la main (et profite des évolutions futures de l'application).
 */
export function ModelesPanel({ modeles }: { modeles: ModeleRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Erreur." });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {msg ? <p className={msg.ok ? "alert-success" : "alert-error"}>{msg.text}</p> : null}
      {modeles.map((m) => (
        <Card key={m.key} title={m.label}>
          <p className="mb-3 text-xs text-muted">
            {m.description}
            {m.surcharge ? (
              <span className="badge-accent ml-2">personnalisé</span>
            ) : (
              <span className="badge-muted ml-2">modèle d'origine</span>
            )}
          </p>
          {ouvert === m.key ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => saveTemplateAction(m.key, new FormData(e.currentTarget as HTMLFormElement)),
                  "Gabarit enregistré.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Sujet" htmlFor={`subject-${m.key}`}>
                <input
                  id={`subject-${m.key}`}
                  name="subject"
                  defaultValue={m.subject}
                  disabled={pending}
                  className="input font-mono text-xs"
                />
              </Field>
              <Field
                label="Corps (HTML)"
                htmlFor={`html-${m.key}`}
                hint="Variables {{…}} : elles sont remplacées à l'envoi (ex. {{logiciel}}, {{echeance}}, {{bouton}}). {{#if variable}}…{{/if}} n'affiche le bloc que si la variable est renseignée."
              >
                <textarea
                  id={`html-${m.key}`}
                  name="html"
                  rows={10}
                  defaultValue={m.html}
                  disabled={pending}
                  className="input font-mono text-xs"
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={pending} className="btn-primary">
                  {pending ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() => setOuvert(null)}
                >
                  Fermer
                </button>
                {m.surcharge ? (
                  <button
                    type="button"
                    className="btn-danger ml-auto"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Abandonner la personnalisation et revenir au modèle d'origine ?",
                        )
                      )
                        run(() => resetTemplateAction(m.key), "Modèle d'origine restauré.");
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Modèle d'origine
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setOuvert(m.key)}>
              Modifier
            </button>
          )}
        </Card>
      ))}
    </div>
  );
}
