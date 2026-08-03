import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { getSession } from "@/server/guards";
import { journal } from "@/server/log";
import { exige2FA } from "@/server/two-factor-policy";

/**
 * Gardes d'autorisation pour les routes `route.ts` (téléchargements, exports…).
 *
 * `requireRole` appelle `redirect()` : sur une page c'est le bon geste ; sur une
 * route qui produit un fichier, le refus deviendrait une redirection 307 vers du
 * HTML. Ici on LÈVE : une variante qui renverrait `null` obligerait l'appelant à
 * penser à tester — l'oublier laisserait passer. En levant, l'oubli produit une
 * erreur 500, moche mais REFUSÉE. *Le mode de défaillance d'un garde doit être
 * le refus, jamais le passage.*
 */

/** Refus d'autorisation destiné à une route API. */
export class ApiAuthError extends Error {
  constructor(
    readonly statut: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

const RANG: Record<Role, number> = { lecteur: 0, admin: 1 };

function refuser(statut: 401 | 403, motif: string, details: Record<string, unknown>): never {
  // Journalisé au niveau AVERTISSEMENT, jamais ERREUR : un refus est le
  // fonctionnement normal d'un garde. On journalise l'identifiant interne et le
  // rôle, JAMAIS l'adresse e-mail : un journal d'exploitation n'a pas à devenir
  // un fichier nominatif.
  journal.avert("guards:api", motif, { statut, ...details });
  throw new ApiAuthError(statut, motif);
}

/** Exige au moins le rôle demandé. Lève `ApiAuthError` sinon. */
export async function requireRoleApi(min: Role, chemin: string) {
  const session = await getSession();
  if (!session) refuser(401, "Authentification requise.", { chemin });

  const role = (session.user as { role?: Role }).role ?? "lecteur";
  if (RANG[role] < RANG[min]) {
    refuser(403, "Droits insuffisants.", { chemin, role, userId: session.user.id });
  }

  // Second facteur exigé (si l'option est active). Sur une page, le garde
  // REDIRIGE vers l'enrôlement ; ici la redirection n'aurait aucun sens — un
  // client qui télécharge un fichier ne s'enrôle pas. On refuse en le disant.
  if (
    (await exige2FA(role)) &&
    !(session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled
  ) {
    refuser(403, "Double authentification requise : activez-la depuis Mon compte › Sécurité.", {
      chemin,
      role,
      userId: session.user.id,
    });
  }
  return session;
}

/**
 * Enveloppe d'une route API : convertit un refus en réponse HTTP explicite.
 * Le corps reste volontairement pauvre — un statut et un message court.
 */
export async function reponseApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statut });
    }
    throw e;
  }
}
