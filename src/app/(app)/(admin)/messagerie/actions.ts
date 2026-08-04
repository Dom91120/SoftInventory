"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUDIT, recordAudit } from "@/server/audit";
import { getConfigMany, setConfigMany, seuilsRappel } from "@/server/config";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/guards";
import { sendMail } from "@/server/mailer";
import { encryptSecret } from "@/server/secret-crypto";
import { DEFAULT_TEMPLATES, MAIL_KINDS, type MailKind } from "@/server/services/mail-templates";

type Result = { ok: true } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[messagerie] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

// ── Réglages SMTP ──

const smtpSchema = z.object({
  from: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Adresse d'expéditeur invalide."),
  fromName: z.string().trim().max(120, "Nom d'expéditeur trop long."),
  host: z.string().trim().max(200, "Hôte trop long."),
  port: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 65535),
      "Port invalide.",
    ),
  security: z.enum(["", "tls", "ssl"]),
  username: z.string().trim().max(200, "Identifiant trop long."),
  password: z.string().max(500, "Mot de passe trop long."),
});

export async function saveMailConfigAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = smtpSchema.safeParse({
    from: formData.get("from") ?? "",
    fromName: formData.get("fromName") ?? "",
    host: formData.get("host") ?? "",
    port: formData.get("port") ?? "",
    security: formData.get("security") ?? "",
    username: formData.get("username") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const v = parsed.data;
  try {
    const entries: Record<string, string> = {
      "mail.from": v.from,
      "mail.fromName": v.fromName,
      "mail.host": v.host,
      "mail.port": v.port,
      "mail.security": v.security,
      "mail.username": v.username,
    };
    // Mot de passe : champ laissé VIDE = inchangé (il n'est jamais réaffiché).
    if (v.password !== "") entries["mail.password"] = encryptSecret(v.password);
    await setConfigMany(entries);
    await recordAudit(AUDIT.MAIL_CONFIG_CHANGED, {
      details: { host: v.host, port: v.port, username: v.username },
    });
    revalidatePath("/messagerie");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/** Seuils de rappel + destinataires par défaut des rappels d'échéances. */
const rappelsSchema = z.object({
  tacheJours: z.coerce.number().int().min(0).max(365),
  contratJours: z.coerce.number().int().min(0).max(365),
  destinataires: z
    .string()
    .trim()
    .max(1000)
    .refine(
      (v) =>
        v === "" ||
        v
          .split(/[,;\s]+/)
          .filter(Boolean)
          .every((m) => z.email().safeParse(m).success),
      "Liste d'adresses invalide (séparez-les par des virgules).",
    ),
});

export async function saveRappelsConfigAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = rappelsSchema.safeParse({
    tacheJours: formData.get("tacheJours") ?? "",
    contratJours: formData.get("contratJours") ?? "",
    destinataires: formData.get("destinataires") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await setConfigMany({
      "tache.rappelJoursAvant": String(parsed.data.tacheJours),
      "contrat.rappelJoursAvant": String(parsed.data.contratJours),
      "tache.destinatairesDefaut": parsed.data.destinataires,
    });
    revalidatePath("/messagerie");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function sendTestMailAction(formData: FormData): Promise<Result> {
  const session = await requireRole("admin");
  const to = String(formData.get("to") ?? "").trim() || session.user.email;
  if (!z.email().safeParse(to).success) return { ok: false, error: "Adresse invalide." };
  try {
    await sendMail({
      to,
      subject: "SoftInventory — e-mail de test",
      html: "<p>Bonjour,</p><p>La configuration SMTP de SoftInventory fonctionne : cet e-mail de test en est la preuve.</p>",
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `Envoi impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    };
  }
}

// ── Gabarits ──

const estMailKind = (v: string): v is MailKind => (MAIL_KINDS as string[]).includes(v);

export async function saveTemplateAction(kind: string, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!estMailKind(kind)) return { ok: false, error: "Gabarit inconnu." };
  const subject = String(formData.get("subject") ?? "").slice(0, 300);
  const html = String(formData.get("html") ?? "").slice(0, 20000);
  try {
    const def = DEFAULT_TEMPLATES[kind];
    await prisma.mailTemplate.upsert({
      where: { key: kind },
      update: { subject, html },
      create: {
        key: kind,
        label: def.label,
        description: def.description,
        subject,
        html,
        builtin: true,
        position: def.position,
      },
    });
    revalidatePath("/messagerie");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/** Revenir au gabarit du code : on VIDE la surcharge (repli par champ). */
export async function resetTemplateAction(kind: string): Promise<Result> {
  await requireRole("admin");
  if (!estMailKind(kind)) return { ok: false, error: "Gabarit inconnu." };
  try {
    await prisma.mailTemplate.updateMany({ where: { key: kind }, data: { subject: "", html: "" } });
    revalidatePath("/messagerie");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

// ── E-mails en échec ──

export async function retryFailedMailAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const mail = await prisma.failedMail.findUnique({ where: { id } });
  if (!mail) return { ok: false, error: "E-mail introuvable." };
  try {
    await sendMail({ to: mail.toAddr, subject: mail.subject, html: mail.html, text: mail.text });
    await prisma.failedMail.delete({ where: { id } });
    revalidatePath("/messagerie");
    return { ok: true };
  } catch (e) {
    await prisma.failedMail.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastTriedAt: new Date(),
        error: e instanceof Error ? e.message : "Erreur inconnue.",
      },
    });
    revalidatePath("/messagerie");
    return {
      ok: false,
      error: `L'envoi a de nouveau échoué : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    };
  }
}

export async function deleteFailedMailAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  try {
    await prisma.failedMail.delete({ where: { id } });
    revalidatePath("/messagerie");
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/**
 * Réglages actuels pour l'écran (mot de passe jamais renvoyé). Gardée comme
 * toute fonction de ce fichier : « use server » expose chaque export en
 * endpoint appelable — sans le garde, n'importe quel compte lirait la config.
 */
export async function lireConfigMessagerie() {
  await requireRole("admin");
  const [cfg, seuils] = await Promise.all([
    getConfigMany([
      "mail.from",
      "mail.fromName",
      "mail.host",
      "mail.port",
      "mail.security",
      "mail.username",
      "mail.password",
      "tache.destinatairesDefaut",
    ]),
    // Les seuils passent par seuilsRappel et NON par un repli écrit ici : cet
    // écran affichait 60 quand la clé était vide, alors que le cron appliquait
    // déjà 90. L'écran aurait proposé un délai que personne n'appliquait — la
    // divergence même que la centralisation devait supprimer.
    seuilsRappel(),
  ]);
  return {
    from: cfg["mail.from"],
    fromName: cfg["mail.fromName"],
    host: cfg["mail.host"],
    port: cfg["mail.port"],
    security: cfg["mail.security"],
    username: cfg["mail.username"],
    passwordDefini: cfg["mail.password"] !== "",
    tacheJours: String(seuils.tache),
    contratJours: String(seuils.contrat),
    destinataires: cfg["tache.destinatairesDefaut"],
  };
}
