"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUDIT, recordAudit } from "@/server/audit";
import { getConfigMany, setConfigMany } from "@/server/config";
import { requireRole } from "@/server/guards";
import { FILTRE_PAR_DEFAUT, testerConnexionLdap } from "@/server/ldap";
import { encryptSecret } from "@/server/secret-crypto";
import { CLE_EXIGER_2FA_ADMIN } from "@/server/two-factor-policy";

type Result = { ok: true; detail?: string } | { ok: false; error: string };

const ldapSchema = z.object({
  actif: z.boolean(),
  url: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === "" || /^ldaps?:\/\/\S+$/i.test(v),
      "URL invalide (ldap://serveur:389 ou ldaps://serveur:636).",
    ),
  baseDn: z.string().trim().max(300, "Base DN trop longue."),
  bindDn: z.string().trim().max(300, "DN du compte de service trop long."),
  bindPassword: z.string().max(500),
  filtreUtilisateur: z
    .string()
    .trim()
    .max(500, "Filtre trop long.")
    .refine((v) => v === "" || v.includes("{login}"), "Le filtre doit contenir {login}."),
  groupeAdmin: z.string().trim().max(300, "Groupe admin trop long."),
  groupeLecteur: z.string().trim().max(300, "Groupe lecteur trop long."),
});

export async function saveLdapConfigAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = ldapSchema.safeParse({
    actif: formData.get("actif") === "on",
    url: formData.get("url") ?? "",
    baseDn: formData.get("baseDn") ?? "",
    bindDn: formData.get("bindDn") ?? "",
    bindPassword: formData.get("bindPassword") ?? "",
    filtreUtilisateur: formData.get("filtreUtilisateur") ?? "",
    groupeAdmin: formData.get("groupeAdmin") ?? "",
    groupeLecteur: formData.get("groupeLecteur") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const v = parsed.data;
  if (v.actif && (!v.url || !v.baseDn)) {
    return {
      ok: false,
      error: "Pour activer l'annuaire, renseignez au moins l'URL du serveur et la base DN.",
    };
  }
  try {
    const entries: Record<string, string> = {
      "ldap.actif": v.actif ? "true" : "false",
      "ldap.url": v.url,
      "ldap.baseDn": v.baseDn,
      "ldap.bindDn": v.bindDn,
      "ldap.filtreUtilisateur": v.filtreUtilisateur,
      "ldap.groupeAdmin": v.groupeAdmin,
      "ldap.groupeLecteur": v.groupeLecteur,
    };
    // Mot de passe du compte de service : vide = inchangé (jamais réaffiché).
    if (v.bindPassword !== "") entries["ldap.bindPassword"] = encryptSecret(v.bindPassword);
    await setConfigMany(entries);
    await recordAudit(AUDIT.LDAP_CONFIG_CHANGED, {
      details: { actif: v.actif, url: v.url, baseDn: v.baseDn, bindDn: v.bindDn },
    });
    revalidatePath("/authentification");
    return { ok: true };
  } catch (e) {
    console.error("[authentification] enregistrement LDAP impossible:", e);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}

export async function testLdapAction(): Promise<Result> {
  await requireRole("admin");
  const r = await testerConnexionLdap();
  return r.ok ? { ok: true, detail: r.detail } : { ok: false, error: r.detail };
}

export async function save2faAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const exiger = formData.get("exiger2fa") === "on";
  try {
    await setConfigMany({ [CLE_EXIGER_2FA_ADMIN]: exiger ? "true" : "false" });
    await recordAudit(AUDIT.SECURITY_CONFIG_CHANGED, { details: { exiger2faAdmin: exiger } });
    revalidatePath("/authentification");
    return { ok: true };
  } catch (e) {
    console.error("[authentification] enregistrement 2FA impossible:", e);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}

/** Réglages actuels (secrets jamais renvoyés). Gardée : « use server » expose l'export. */
export async function lireConfigAuthentification() {
  await requireRole("admin");
  const cfg = await getConfigMany([
    "ldap.actif",
    "ldap.url",
    "ldap.baseDn",
    "ldap.bindDn",
    "ldap.bindPassword",
    "ldap.filtreUtilisateur",
    "ldap.groupeAdmin",
    "ldap.groupeLecteur",
    CLE_EXIGER_2FA_ADMIN,
  ]);
  return {
    actif: cfg["ldap.actif"] === "true",
    url: cfg["ldap.url"],
    baseDn: cfg["ldap.baseDn"],
    bindDn: cfg["ldap.bindDn"],
    bindPasswordDefini: cfg["ldap.bindPassword"] !== "",
    filtreUtilisateur: cfg["ldap.filtreUtilisateur"] || FILTRE_PAR_DEFAUT,
    groupeAdmin: cfg["ldap.groupeAdmin"],
    groupeLecteur: cfg["ldap.groupeLecteur"],
    exiger2fa: cfg[CLE_EXIGER_2FA_ADMIN] === "true",
  };
}
