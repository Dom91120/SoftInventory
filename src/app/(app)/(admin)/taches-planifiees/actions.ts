"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/guards";
import {
  CRON_TASKS,
  type CronSchedule,
  type CronTaskKey,
  isValidSchedule,
  recordCronRun,
  setCronSchedule,
} from "@/server/services/cron-tasks";
import { envoyerRappelsEcheances, summarizeEcheances } from "@/server/services/echeances-mail";
import { purgerDonneesTechniques } from "@/server/services/retention";

type Result = { ok: true; summary?: string } | { ok: false; error: string };

const estCle = (v: string): v is CronTaskKey => CRON_TASKS.some((t) => t.key === v);

export async function saveScheduleAction(key: string, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!estCle(key)) return { ok: false, error: "Tâche inconnue." };

  const type = String(formData.get("type") ?? "");
  let schedule: CronSchedule;
  if (type === "everyMinutes") {
    schedule = { type: "everyMinutes", step: Number(formData.get("step")) };
  } else {
    schedule = {
      type: "dailyAt",
      hour: Number(formData.get("hour")),
      minute: Number(formData.get("minute")),
    };
  }
  if (!isValidSchedule(schedule)) {
    return { ok: false, error: "Planification invalide (heure 0-23, minutes 0-59, pas ≥ 5 min)." };
  }
  await setCronSchedule(key, schedule);
  revalidatePath("/taches-planifiees");
  return { ok: true };
}

/**
 * Exécution MANUELLE, hors planification (le déclenchement planifié n'est pas
 * marqué : l'échéance du cron reste due). Consignée « manuel » dans le journal.
 */
export async function runNowAction(key: string): Promise<Result> {
  await requireRole("admin");
  if (!estCle(key)) return { ok: false, error: "Tâche inconnue." };
  try {
    const summary =
      key === "echeances"
        ? summarizeEcheances(await envoyerRappelsEcheances())
        : await purgerDonneesTechniques();
    await recordCronRun(key, { ok: true, trigger: "manuel", summary });
    revalidatePath("/taches-planifiees");
    return { ok: true, summary };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erreur inconnue.";
    await recordCronRun(key, { ok: false, trigger: "manuel", summary: detail });
    revalidatePath("/taches-planifiees");
    return { ok: false, error: `Échec : ${detail}` };
  }
}
