"use server";

import { revalidatePath } from "next/cache";
import { contratSchema } from "@/schemas/logiciel";
import { requireRole } from "@/server/guards";
import {
  attacherLogiciel,
  cheminsDuContrat,
  createContrat,
  detacherLogiciel,
} from "@/server/services/contrats";
import { deleteContrat, getContrat, updateContrat } from "@/server/services/logiciels";

type Result = { ok: true; id?: number } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[contrats] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

/**
 * Champs du marché, et eux seuls : les rattachements ne passent PAS par ce
 * formulaire. Ils s'appliquent au clic, un par un (voir attacher/detacher) —
 * comme les serveurs de l'onglet Liaisons. Les faire transiter ici obligerait
 * à réconcilier une liste à chaque enregistrement, et un champ oublié dans le
 * POST effacerait tous les liens.
 */
function parse(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return contratSchema.safeParse({
    libelle: get("libelle"),
    fournisseurId: get("fournisseurId"),
    referenceMarche: get("referenceMarche"),
    montantAnnuel: get("montantAnnuel"),
    montantMaxi: get("montantMaxi"),
    montantTotal: get("montantTotal"),
    dateDebut: get("dateDebut"),
    dateFin: get("dateFin"),
    notes: get("notes"),
  });
}

async function revalide(contratId: number, chemins?: string[]) {
  for (const p of chemins ?? (await cheminsDuContrat(contratId))) revalidatePath(p);
}

export async function createContratFicheAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    // Sans rattachement : le marché n'existe pas encore quand on saisit ses
    // champs. L'écran redirige vers sa fiche, où les logiciels se cochent.
    const created = await createContrat(parsed.data);
    await revalide(created.id);
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateContratFicheAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  if (!(await getContrat(id))) return { ok: false, error: "Marché introuvable." };
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await updateContrat(id, parsed.data);
    await revalide(id);
    return { ok: true, id };
  } catch (e) {
    return inattendu(e);
  }
}

/**
 * Rattache un logiciel au marché, aussitôt — pas de bouton Enregistrer à
 * cliquer derrière. Revalide AVANT et APRÈS : l'onglet du logiciel concerné
 * doit voir le marché apparaître, et il ne figure pas encore dans les chemins
 * calculés avant le lien.
 */
export async function attacherLogicielAction(
  contratId: number,
  logicielId: number,
): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(contratId) || contratId < 1 || !Number.isInteger(logicielId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  try {
    await attacherLogiciel(contratId, logicielId);
    await revalide(contratId);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/** Détache le logiciel. Ni le marché ni le logiciel ne sont supprimés. */
export async function detacherLogicielAction(
  contratId: number,
  logicielId: number,
): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(contratId) || contratId < 1 || !Number.isInteger(logicielId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  try {
    // Chemins d'abord : après le détachement, la fiche du logiciel ne fait plus
    // partie de ceux du marché et resterait sur son ancien affichage.
    const chemins = await cheminsDuContrat(contratId);
    await detacherLogiciel(contratId, logicielId);
    await revalide(contratId, chemins);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function deleteContratFicheAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  if (!(await getContrat(id))) return { ok: false, error: "Marché introuvable." };
  try {
    // Chemins relevés AVANT : la suppression emporte les rattachements.
    const chemins = await cheminsDuContrat(id);
    // Non bloquée par ses pièces : elle les emporte, fichiers du disque compris.
    await deleteContrat(id);
    await revalide(id, chemins);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}
