import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import {
  CRON_TASKS,
  getCronRuns,
  getCronSchedules,
  getLastCronAts,
  nextCronRun,
  scheduleLabel,
} from "@/server/services/cron-tasks";
import { CronPanel, type TacheCronRow } from "./cron-panel";

export const metadata: Metadata = { title: "Tâches planifiées" };

export default async function TachesPlanifieesPage() {
  await requireRole("admin");
  const [schedules, runs, lastCronAts] = await Promise.all([
    getCronSchedules(),
    getCronRuns(),
    getLastCronAts(),
  ]);
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

  const rows: TacheCronRow[] = CRON_TASKS.map((t) => {
    const s = schedules[t.key];
    const run = runs[t.key];
    return {
      key: t.key,
      label: t.label,
      description: t.description,
      scheduleType: s.type,
      step: s.type === "everyMinutes" ? s.step : 0,
      hour: s.type === "dailyAt" ? s.hour : 7,
      minute: s.type === "dailyAt" ? s.minute : 0,
      scheduleLabel: scheduleLabel(s),
      prochaineExecution: fmt.format(nextCronRun(s, lastCronAts[t.key] ?? null)),
      derniereExecution: run
        ? `${fmt.format(new Date(run.at))} · ${run.trigger} · ${run.summary}`
        : null,
      derniereOk: run ? run.ok : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Tâches planifiées"
        subtitle="Horaires des travaux automatiques et journal de leurs exécutions"
      />
      <CronPanel taches={rows} />
    </>
  );
}
