"use server";

import { revalidatePath } from "next/cache";
import { editeurSchema } from "@/schemas/editeur";
import { AUDIT, recordAudit } from "@/server/audit";
import { requireRole } from "@/server/guards";
import {
  compterPiecesEditeur,
  createEditeur,
  deleteEditeur,
  getEditeur,
  updateEditeur,
} from "@/server/services/editeurs";

type Result = { ok: true; id?: number } | { ok: false; error: string };

function messageErreur(e: unknown): string {
  if ((e as { code?: string })?.code === "P2002") return "Un éditeur porte déjà ce nom.";
  console.error("[editeurs] erreur inattendue:", e);
  return "Une erreur est survenue. Réessayez.";
}

/** Extrait et valide les champs du formulaire éditeur. */
function parseForm(formData: FormData) {
  return editeurSchema.safeParse({
    nom: formData.get("nom") ?? "",
    adresse: formData.get("adresse") ?? "",
    codePostal: formData.get("codePostal") ?? "",
    ville: formData.get("ville") ?? "",
    telephone: formData.get("telephone") ?? "",
    email: formData.get("email") ?? "",
    siteWeb: formData.get("siteWeb") ?? "",
    supportUrl: formData.get("supportUrl") ?? "",
    supportEmail: formData.get("supportEmail") ?? "",
    supportTelephone: formData.get("supportTelephone") ?? "",
    supportHoraires: formData.get("supportHoraires") ?? "",
    supportHoraires2: formData.get("supportHoraires2") ?? "",
    commercialContact: formData.get("commercialContact") ?? "",
    commercialTelephone: formData.get("commercialTelephone") ?? "",
    commercialEmail: formData.get("commercialEmail") ?? "",
    adminContact: formData.get("adminContact") ?? "",
    adminTelephone: formData.get("adminTelephone") ?? "",
    adminEmail: formData.get("adminEmail") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createEditeurAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await createEditeur(parsed.data);
    revalidatePath("/editeurs");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
}

export async function updateEditeurAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await updateEditeur(id, parsed.data);
    revalidatePath("/editeurs");
    revalidatePath(`/editeurs/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
}

export async function deleteEditeurAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const editeur = await getEditeur(id);
  if (!editeur) return { ok: false, error: "Éditeur introuvable." };
  // Même garde que les autres suppressions : la cascade efface les lignes
  // `documents` sans retirer les fichiers du disque.
  const pieces = await compterPiecesEditeur(id);
  if (pieces > 0) {
    return {
      ok: false,
      error:
        pieces === 1
          ? "Supprimez d'abord la pièce jointe de cette fiche."
          : `Supprimez d'abord les ${pieces} pièces jointes de cette fiche.`,
    };
  }
  try {
    await deleteEditeur(id);
  } catch (e) {
    // P2003 arrivera en phase 3, quand des logiciels référenceront l'éditeur.
    if ((e as { code?: string })?.code === "P2003") {
      return {
        ok: false,
        error: "Suppression impossible : des logiciels référencent encore cet éditeur.",
      };
    }
    return { ok: false, error: messageErreur(e) };
  }
  await recordAudit(AUDIT.EDITEUR_DELETED, { target: editeur.nom });
  revalidatePath("/editeurs");
  return { ok: true };
}
