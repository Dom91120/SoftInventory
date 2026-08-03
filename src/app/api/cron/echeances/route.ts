import { runScheduledTask } from "@/server/cron-route";
import { envoyerRappelsEcheances, summarizeEcheances } from "@/server/services/echeances-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rappels d'échéances (tâches récurrentes + contrats). Le crontab
 * appelle toutes les 5 min ; runScheduledTask ne lance le travail qu'à
 * l'horaire configuré (défaut : quotidien à 07:00, heure de Paris).
 */
export function GET() {
  return runScheduledTask("echeances", async () => {
    const r = await envoyerRappelsEcheances();
    return { summary: summarizeEcheances(r), payload: r };
  });
}
