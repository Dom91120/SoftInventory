import { purgeOldAuditEntries } from "@/server/audit";
import { prisma } from "@/server/db";

const JOURS_FAILED_MAILS = 90;
const JOURS_LOGIN_ATTEMPTS = 30;

/**
 * Purge des données techniques périmées : journal d'administration (2 ans),
 * e-mails en échec (90 j), compteurs de connexion inactifs. Partagée par la
 * route cron et l'exécution manuelle de l'admin.
 */
export async function purgerDonneesTechniques(): Promise<string> {
  const [audit, mails, attempts, buckets] = await Promise.all([
    purgeOldAuditEntries(),
    prisma.failedMail.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - JOURS_FAILED_MAILS * 86_400_000) } },
    }),
    prisma.loginAttempt.deleteMany({
      where: { lastFailureAt: { lt: new Date(Date.now() - JOURS_LOGIN_ATTEMPTS * 86_400_000) } },
    }),
    prisma.throttleBucket.deleteMany({ where: { resetAt: { lt: new Date() } } }),
  ]);
  return `${audit} entrée(s) d'audit, ${mails.count} e-mail(s) en échec, ${attempts.count + buckets.count} compteur(s) purgés`;
}
