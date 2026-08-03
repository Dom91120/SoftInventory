"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { runNowAction, saveScheduleAction } from "./actions";

export type TacheCronRow = {
  key: string;
  label: string;
  description: string;
  scheduleType: "everyMinutes" | "dailyAt";
  step: number;
  hour: number;
  minute: number;
  scheduleLabel: string;
  prochaineExecution: string;
  derniereExecution: string | null; // « 01/08/2026 07:00 · cron · résumé » ou null
  derniereOk: boolean | null;
};

export function CronPanel({ taches }: { taches: TacheCronRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; summary?: string }>,
    okText: string,
  ) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(
        res.ok
          ? { ok: true, text: res.summary ? `${okText} — ${res.summary}` : okText }
          : { ok: false, text: res.error ?? "Erreur." },
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {msg ? <p className={msg.ok ? "alert-success" : "alert-error"}>{msg.text}</p> : null}
      {taches.map((t) => (
        <Card
          key={t.key}
          title={t.label}
          actions={
            <button
              type="button"
              className="btn-secondary !py-1.5"
              disabled={pending}
              onClick={() => run(() => runNowAction(t.key), "Tâche exécutée")}
            >
              <Play className="h-4 w-4" />
              Exécuter maintenant
            </button>
          }
        >
          <p className="mb-4 text-sm text-muted">{t.description}</p>
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="label !mb-0">Planification</span>
              <span className="text-body">{t.scheduleLabel}</span>
              <span className="block text-xs text-faint">
                Prochaine exécution : {t.prochaineExecution}
              </span>
            </div>
            <div>
              <span className="label !mb-0">Dernière exécution</span>
              {t.derniereExecution ? (
                <span className={t.derniereOk ? "text-body" : "text-danger"}>
                  {t.derniereExecution}
                </span>
              ) : (
                <span className="text-faint">jamais exécutée</span>
              )}
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => saveScheduleAction(t.key, new FormData(e.currentTarget as HTMLFormElement)),
                "Planification enregistrée",
              );
            }}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <ScheduleFields row={t} disabled={pending} />
            <button type="submit" disabled={pending} className="btn-primary !py-1.5">
              Enregistrer
            </button>
          </form>
        </Card>
      ))}
      <p className="text-xs text-faint">
        Le conteneur cron appelle chaque tâche toutes les 5 minutes ; c'est l'application qui
        décide, selon cette planification, si le travail est dû. Modifier un horaire ne demande
        aucun redéploiement.
      </p>
    </div>
  );
}

function ScheduleFields({ row, disabled }: { row: TacheCronRow; disabled: boolean }) {
  const [type, setType] = useState(row.scheduleType);
  return (
    <>
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value as "everyMinutes" | "dailyAt")}
        disabled={disabled}
        className="input !w-auto"
        aria-label="Type de planification"
      >
        <option value="dailyAt">Tous les jours à…</option>
        <option value="everyMinutes">Toutes les…</option>
      </select>
      {type === "dailyAt" ? (
        <>
          <input
            name="hour"
            type="number"
            min={0}
            max={23}
            defaultValue={row.hour}
            disabled={disabled}
            className="input !w-20"
            aria-label="Heure"
          />
          <span className="text-muted">h</span>
          <input
            name="minute"
            type="number"
            min={0}
            max={59}
            defaultValue={row.minute}
            disabled={disabled}
            className="input !w-20"
            aria-label="Minutes"
          />
        </>
      ) : (
        <>
          <input
            name="step"
            type="number"
            min={5}
            max={1440}
            defaultValue={row.step || 60}
            disabled={disabled}
            className="input !w-24"
            aria-label="Pas en minutes"
          />
          <span className="text-muted">minutes</span>
        </>
      )}
    </>
  );
}
