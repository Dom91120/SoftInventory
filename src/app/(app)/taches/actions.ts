"use server";

import { revalidatePath } from "next/cache";
import { completerTacheSchema, tacheSchema } from "@/schemas/tache";
import { requireRole } from "@/server/guards";
import * as svc from "@/server/services/taches";

type Result = { ok: true } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[taches] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

const idValide = (id: unknown): id is number => Number.isInteger(id) && (id as number) >= 1;

function parseTache(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return tacheSchema.safeParse({
    titre: get("titre"),
    description: get("description"),
    typeTacheId: get("typeTacheId"),
    periodicite: get("periodicite"),
    moisPersonnalises: get("moisPersonnalises"),
    prochaineEcheance: get("prochaineEcheance"),
    statut: get("statut") || "active",
    assigneUserId: get("assigneUserId"),
    assigneLibre: get("assigneLibre"),
    rappelJoursAvant: get("rappelJoursAvant"),
  });
}

function revalider(logicielId: number) {
  revalidatePath(`/logiciels/${logicielId}`);
  revalidatePath("/taches");
  revalidatePath("/tableau-de-bord");
}

export async function createTacheAction(logicielId: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(logicielId)) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseTache(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.createTache(logicielId, parsed.data);
    revalider(logicielId);
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2003") {
      return { ok: false, error: "Logiciel, type de tâche ou assigné introuvable." };
    }
    return inattendu(e);
  }
}

export async function updateTacheAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const tache = await svc.getTache(id);
  if (!tache) return { ok: false, error: "Tâche introuvable." };
  const parsed = parseTache(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updateTache(id, parsed.data);
    revalider(tache.logicielId);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function deleteTacheAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const tache = await svc.getTache(id);
  if (!tache) return { ok: false, error: "Tâche introuvable." };
  try {
    await svc.deleteTache(id);
    revalider(tache.logicielId);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/**
 * Marquer l'occurrence courante comme FAITE. Ouvert aux admins uniquement —
 * le lecteur consulte. (L'assignation à un compte lecteur reste possible : la
 * personne signale au service informatique, qui complète.)
 */
export async function completerTacheAction(id: number, formData: FormData): Promise<Result> {
  const session = await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const parsed = completerTacheSchema.safeParse({
    commentaire: String(formData.get("commentaire") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const tache = await svc.getTache(id);
  if (!tache) return { ok: false, error: "Tâche introuvable." };
  try {
    const res = await svc.completerTache(
      id,
      { id: session.user.id, label: session.user.email },
      parsed.data.commentaire,
    );
    if (!res.ok) return res;
    revalider(tache.logicielId);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}
