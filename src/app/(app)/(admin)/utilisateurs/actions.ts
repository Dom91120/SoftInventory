"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUDIT, recordAudit } from "@/server/audit";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/guards";

type Result = { ok: true } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[utilisateurs] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

const compteSchema = z.object({
  email: z.email("Adresse e-mail invalide.").max(200),
  prenom: z.string().trim().max(80, "Prénom trop long."),
  nom: z.string().trim().max(80, "Nom trop long."),
  role: z.enum(["lecteur", "admin"]),
});

/**
 * Création d'un compte par un admin : mot de passe ALÉATOIRE jamais communiqué
 * — l'agent reçoit un lien « définir mon mot de passe » (flux de
 * réinitialisation). L'appel interne à signUpEmail est exempté du blocage
 * d'inscription publique (pas de ctx.request).
 */
export async function createUserAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = compteSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    prenom: formData.get("prenom") ?? "",
    nom: formData.get("nom") ?? "",
    role: formData.get("role") ?? "lecteur",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const { email, prenom, nom, role } = parsed.data;
  try {
    const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existe) return { ok: false, error: "Un compte existe déjà pour cette adresse." };

    // ≥ 12 caractères + complexité : satisfait la politique de mots de passe.
    const motDePasseAleatoire = `Aa1!${randomBytes(24).toString("base64url")}`;
    await auth.api.signUpEmail({
      body: {
        email,
        password: motDePasseAleatoire,
        name: `${prenom} ${nom}`.trim() || email,
        prenom,
        nom,
      },
    });
    // `role` est input:false côté Better Auth : posé directement, avec
    // emailVerified (adresse professionnelle fournie par l'admin).
    await prisma.user.update({ where: { email }, data: { role, emailVerified: true } });
    await recordAudit(AUDIT.USER_CREATED, { target: email, details: { role } });

    // Lien « définir mon mot de passe » (best-effort : sans SMTP, l'admin
    // pourra le renvoyer depuis la liste).
    try {
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: "/auth/reset-password" },
      });
      await recordAudit(AUDIT.USER_PASSWORD_RESET_SENT, { target: email });
    } catch (e) {
      console.error("[utilisateurs] lien de définition du mot de passe non envoyé:", e);
    }

    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateUserAction(userId: string, formData: FormData): Promise<Result> {
  const session = await requireRole("admin");
  const cible = await prisma.user.findUnique({ where: { id: userId } });
  if (!cible) return { ok: false, error: "Compte introuvable." };
  const parsed = compteSchema.safeParse({
    email: cible.email, // l'adresse ne se modifie pas ici
    prenom: formData.get("prenom") ?? "",
    nom: formData.get("nom") ?? "",
    role: formData.get("role") ?? "lecteur",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const { prenom, nom, role } = parsed.data;
  // Un admin ne peut pas se rétrograder lui-même : le dernier admin resterait
  // sinon enfermé dehors.
  if (cible.id === session.user.id && role !== "admin") {
    return { ok: false, error: "Vous ne pouvez pas retirer votre propre rôle d'administrateur." };
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { prenom, nom, role, name: `${prenom} ${nom}`.trim() || cible.email },
    });
    if (role !== cible.role) {
      await recordAudit(AUDIT.USER_ROLE_CHANGED, {
        target: cible.email,
        details: { de: cible.role, vers: role },
      });
    } else {
      await recordAudit(AUDIT.USER_UPDATED, { target: cible.email });
    }
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function deleteUserAction(userId: string): Promise<Result> {
  const session = await requireRole("admin");
  if (userId === session.user.id) {
    return { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." };
  }
  const cible = await prisma.user.findUnique({ where: { id: userId } });
  if (!cible) return { ok: false, error: "Compte introuvable." };
  try {
    await prisma.user.delete({ where: { id: userId } });
    await recordAudit(AUDIT.USER_DELETED, { target: cible.email });
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function sendResetAction(userId: string): Promise<Result> {
  await requireRole("admin");
  const cible = await prisma.user.findUnique({ where: { id: userId } });
  if (!cible) return { ok: false, error: "Compte introuvable." };
  if (cible.ldap) {
    return {
      ok: false,
      error: "Compte annuaire : le mot de passe se gère dans l'Active Directory.",
    };
  }
  try {
    await auth.api.requestPasswordReset({
      body: { email: cible.email, redirectTo: "/auth/reset-password" },
    });
    await recordAudit(AUDIT.USER_PASSWORD_RESET_SENT, { target: cible.email });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `Envoi impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    };
  }
}

/** Retire le second facteur d'un compte (agent qui a perdu son téléphone). */
export async function reset2faAction(userId: string): Promise<Result> {
  await requireRole("admin");
  const cible = await prisma.user.findUnique({ where: { id: userId } });
  if (!cible) return { ok: false, error: "Compte introuvable." };
  try {
    await prisma.$transaction([
      prisma.twoFactor.deleteMany({ where: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
    ]);
    await recordAudit(AUDIT.USER_2FA_RESET, { target: cible.email });
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}
