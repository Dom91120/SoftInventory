import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/client";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { checkSessionPolicy, sessionDeadlineAt, shouldTouch } from "@/server/session-policy";
import { CHEMIN_ENROLEMENT, exige2FA } from "@/server/two-factor-policy";

/** Hiérarchie des rôles : un admin satisfait aussi un guard lecteur. */
const RANK: Record<Role, number> = {
  lecteur: 0,
  admin: 1,
};

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * État PAR REQUÊTE (React.cache mémoïse par rendu) : mémorise qu'une session a été
 * révoquée pour dépassement de délai. Permet à `requireUser` de distinguer « session
 * expirée » (message à l'écran de connexion) de « jamais connecté » (page nue).
 */
const revocation = cache(() => ({ expired: false }));

/**
 * Lit la session, APPLIQUE la politique d'inactivité / de durée absolue
 * (server/session-policy.ts) et, si `touch`, horodate l'activité de l'usager.
 *
 * Une session hors politique est RÉVOQUÉE (ligne supprimée) avant de renvoyer
 * null : le cookie résiduel du navigateur ne désigne alors plus rien. La
 * suppression en base est préférée à `signOut` : Next.js interdit d'écrire un
 * cookie pendant le rendu d'un Server Component, où ces gardes sont appelées.
 */
async function readSession(touch: boolean): Promise<SessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const role = (session.user as { role?: Role }).role;
  // `updatedAt` sert de marqueur de dernière activité : il est réécrit par le
  // `touch` ci-dessous (et par le renouvellement natif de Better Auth).
  const lastSeenAt = session.session.updatedAt;
  const verdict = checkSessionPolicy(role, lastSeenAt, session.session.createdAt);

  if (verdict !== "ok") {
    // deleteMany : idempotent (aucune erreur si la session a déjà disparu).
    await prisma.session.deleteMany({ where: { id: session.session.id } });
    revocation().expired = true;
    return null;
  }

  // Horodatage de l'activité, au plus une fois par TOUCH_THROTTLE_MS. Écriture
  // best-effort : un échec ne doit pas casser le rendu de la page.
  if (touch && shouldTouch(lastSeenAt)) {
    try {
      await prisma.session.update({
        where: { id: session.session.id },
        data: { updatedAt: new Date() },
      });
    } catch (e) {
      console.error("[guards] horodatage d'activité échoué:", e);
    }
  }

  return session;
}

/**
 * Renvoie la session courante ou null. Mémoïsée PAR REQUÊTE via React.cache :
 * un même rendu (layout + page + services) ne paie qu'un seul aller-retour
 * Better Auth. COMPTE comme activité (repousse le délai d'inactivité).
 */
export const getSession = cache(async () => readSession(true));

/**
 * Variante qui NE COMPTE PAS comme activité — réservée aux appels AUTOMATIQUES
 * émis par la page (sondage de session) et non par un geste de l'usager. La
 * politique reste APPLIQUÉE : le sondage cesse de répondre dès que la session
 * est hors délai, il se contente de ne pas la prolonger.
 */
export const getSessionNoTouch = cache(async () => readSession(false));

/** Exige un utilisateur connecté, sinon redirige vers la page de connexion. */
export async function requireUser() {
  const session = await getSession();
  // `?expired=1` : l'écran de connexion explique alors la déconnexion.
  if (!session) redirect(revocation().expired ? "/auth/login?expired=1" : "/auth/login");
  return session;
}

/**
 * Échéance de la session courante (epoch ms), ou null si personne n'est connecté.
 * Destinée au composant client de surveillance (components/session-watchdog.tsx).
 */
export async function sessionDeadline(): Promise<number | null> {
  const session = await getSession();
  if (!session) return null;
  const role = (session.user as { role?: Role }).role;
  return sessionDeadlineAt(role, session.session.updatedAt, session.session.createdAt);
}

/** Exige au moins le rôle demandé, sinon redirige. */
export async function requireRole(min: Role) {
  const session = await requireUser();
  const role = (session.user as { role?: Role }).role ?? "lecteur";
  if (RANK[role] < RANK[min]) redirect("/");

  // Second facteur exigé des admins UNIQUEMENT si l'option est activée
  // (app_config, cf. two-factor-policy.ts). REDIRECTION vers l'enrôlement,
  // jamais blocage : les comptes existants n'ont aucun secret TOTP au moment de
  // l'activation de l'option. La page d'enrôlement vit sous /mon-compte, qui
  // n'appelle que `requireUser` — elle échappe par construction à ce garde.
  if (
    (await exige2FA(role)) &&
    !(session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled
  ) {
    redirect(CHEMIN_ENROLEMENT);
  }
  return session;
}
