"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, EmptyState } from "@/components/ui";
import { deleteFailedMailAction, retryFailedMailAction } from "./actions";

export type EchecRow = {
  id: number;
  toAddr: string;
  subject: string;
  error: string;
  attempts: number;
  createdAt: string;
  lastTriedAt: string;
};

/** File des e-mails en échec : renvoyer (supprime si succès) ou abandonner. */
export function EchecsPanel({ echecs }: { echecs: EchecRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Erreur." });
      router.refresh();
    });
  }

  return (
    <Card title={`E-mails en échec (${echecs.length})`}>
      {msg ? (
        <p className={`mb-3 ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</p>
      ) : null}
      {echecs.length === 0 ? (
        <EmptyState>
          Aucun e-mail en attente : les envois qui échouent (SMTP indisponible…) atterrissent ici
          pour être renvoyés.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {echecs.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-medium text-strong">{m.subject || "(sans sujet)"}</span>
                <span className="block text-xs text-muted">
                  à {m.toAddr} · créé le {m.createdAt} · {m.attempts} tentative(s), dernière le{" "}
                  {m.lastTriedAt}
                </span>
                <span className="block truncate text-xs text-danger" title={m.error}>
                  {m.error}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="btn-secondary !py-1.5"
                  disabled={pending}
                  onClick={() => run(() => retryFailedMailAction(m.id), "E-mail renvoyé.")}
                >
                  <RefreshCw className="h-4 w-4" />
                  Renvoyer
                </button>
                <button
                  type="button"
                  className="btn-ghost !p-2 hover:!text-danger"
                  title="Abandonner"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Abandonner définitivement cet e-mail ?"))
                      run(() => deleteFailedMailAction(m.id), "E-mail abandonné.");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
