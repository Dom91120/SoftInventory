import type { Role } from "@/generated/prisma/client";
import { getConfigMany } from "@/server/config";

// ════════════════════════════════════════════════════════════════════════════
//  Second facteur : OPTIONNEL par défaut.
//
//  L'application est interne au réseau de la collectivité et l'authentification
//  passe normalement par l'annuaire (LDAP/AD). L'exigence d'un second facteur
//  pour les admins est donc DÉSACTIVÉE par défaut, mais toute l'infrastructure
//  (plugin Better Auth, table two_factor, écran d'enrôlement) est en place :
//  l'activer se fait depuis Administration › Authentification, sans redéploiement.
//
//  ── Exiger sans jamais verrouiller dehors ──
//  Quand l'option est active, l'exigence n'est PAS appliquée à la connexion :
//  elle l'est à l'entrée des écrans d'administration, sous forme de REDIRECTION
//  vers l'enrôlement. Les comptes existants n'ont aucun secret TOTP au moment de
//  l'activation ; bloquer la connexion mettrait dehors tous les administrateurs
//  — y compris celui qui aurait dû réparer.
// ════════════════════════════════════════════════════════════════════════════

/** Clé app_config : "true" ⇒ les admins doivent disposer d'un second facteur. */
export const CLE_EXIGER_2FA_ADMIN = "securite.exiger2faAdmin";

/** Chemin de l'écran d'enrôlement — hors du périmètre du garde, par construction. */
export const CHEMIN_ENROLEMENT = "/mon-compte/securite";

/** Ce rôle doit-il disposer d'un second facteur pour accéder à l'administration ? */
export async function exige2FA(role: Role | undefined): Promise<boolean> {
  if (role !== "admin") return false;
  const cfg = await getConfigMany([CLE_EXIGER_2FA_ADMIN]);
  return cfg[CLE_EXIGER_2FA_ADMIN] === "true";
}
