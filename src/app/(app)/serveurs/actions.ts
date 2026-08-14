"use server";

import { revalidatePath } from "next/cache";
import { serveurSchema } from "@/schemas/serveur";
import { requireRole } from "@/server/guards";
import {
  createServeur,
  deleteServeur,
  getServeur,
  updateServeur,
} from "@/server/services/serveurs";

// Serveurs : création, modification, suppression depuis LEUR écran — plus
// depuis Référentiels. Pattern maison : guard → parse → service →
// revalidatePath → {ok|error}.

type Result = { ok: true; id?: number } | { ok: false; error: string };

function messageErreur(e: unknown): string {
  if ((e as { code?: string })?.code === "P2002") return "Un serveur porte déjà ce nom.";
  console.error("[serveurs] erreur inattendue:", e);
  return "Une erreur est survenue. Réessayez.";
}

function parseForm(formData: FormData) {
  return serveurSchema.safeParse({
    nom: formData.get("nom") ?? "",
    os: formData.get("os") ?? "",
    localisation: formData.get("localisation") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createServeurAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await createServeur(parsed.data);
    revalidatePath("/serveurs");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
}

export async function updateServeurAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await updateServeur(id, parsed.data);
    revalidatePath("/serveurs");
    revalidatePath(`/serveurs/${id}`);
    // Le nom du serveur paraît sur les liaisons des fiches logiciel et sur les
    // certificats de machine : le renommer doit s'y voir aussi.
    revalidatePath("/logiciels", "layout");
    revalidatePath("/certificats", "layout");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
}

export async function deleteServeurAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const serveur = await getServeur(id);
  if (!serveur) return { ok: false, error: "Serveur introuvable." };
  /**
   * La table de liaison logiciel ↔ serveur est en CASCADE : supprimer le
   * serveur effacerait sans un mot les installations qu'il porte, et les fiches
   * logiciel perdraient l'information « ça tourne là ». On refuse tant qu'il en
   * reste une — c'est depuis l'onglet Liaisons du logiciel qu'on la retire, là
   * où elle a été posée.
   *
   * Les certificats, eux, ne retiennent pas la suppression : leur rattachement
   * est en SetNull, le certificat survit à la machine qu'il équipait (voir
   * `schema.prisma`). La fiche prévient avant d'en arriver là.
   */
  if (serveur.logiciels.length > 0) {
    const n = serveur.logiciels.length;
    return {
      ok: false,
      error:
        n === 1
          ? "Suppression impossible : un logiciel est encore installé sur ce serveur. Retirez d'abord l'installation depuis l'onglet Liaisons de sa fiche."
          : `Suppression impossible : ${n} logiciels sont encore installés sur ce serveur. Retirez d'abord ces installations depuis l'onglet Liaisons de leurs fiches.`,
    };
  }
  try {
    await deleteServeur(id);
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
  revalidatePath("/serveurs");
  revalidatePath("/certificats", "layout");
  return { ok: true };
}
