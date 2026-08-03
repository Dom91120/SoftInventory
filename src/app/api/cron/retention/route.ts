import { runScheduledTask } from "@/server/cron-route";
import { purgerDonneesTechniques } from "@/server/services/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rétention des données techniques (cf. services/retention.ts). */
export function GET() {
  return runScheduledTask("retention", async () => {
    const summary = await purgerDonneesTechniques();
    return { summary };
  });
}
