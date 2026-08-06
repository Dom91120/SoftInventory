"use server";

import { revalidatePath } from "next/cache";
import { contratSchema } from "@/schemas/logiciel";
import { requireRole } from "@/server/guards";
import {
  cheminsDuContrat,
  createContratAvecLogiciels,
  updateContratAvecLogiciels,
} from "@/server/services/contrats";
import { deleteContrat, getContrat } from "@/server/services/logiciels";

type Result = { ok: true; id?: number } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[contrats] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

/**
 * Champs du marché + logiciels couverts. Les rattachements arrivent en valeurs
 * MULTIPLES du même champ (cases à cocher) : `getAll`, pas `get`. Les entrées
 * illisibles sont écartées plutôt que de faire échouer la saisie — une case
 * cochée ne peut valoir qu'un id, et un id inconnu serait de toute façon rejeté
 * par la clé étrangère.
 */
function parse(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  const logicielIds = [
    ...new Set(
      formData
        .getAll("logicielIds")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  return {
    parsed: contratSchema.safeParse({
      libelle: get("libelle"),
      fournisseurId: get("fournisseurId"),
      referenceMarche: get("referenceMarche"),
      montantAnnuel: get("montantAnnuel"),
      montantMaxi: get("montantMaxi"),
      montantTotal: get("montantTotal"),
      dateDebut: get("dateDebut"),
      dateFin: get("dateFin"),
      notes: get("notes"),
    }),
    logicielIds,
  };
}

async function revalide(contratId: number, chemins?: string[]) {
  for (const p of chemins ?? (await cheminsDuContrat(contratId))) revalidatePath(p);
}

export async function createContratFicheAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const { parsed, logicielIds } = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await createContratAvecLogiciels(parsed.data, logicielIds);
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
  const { parsed, logicielIds } = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    // Les chemins d'AVANT aussi : un logiciel qu'on vient de détacher doit voir
    // le marché disparaître de son onglet.
    const avant = await cheminsDuContrat(id);
    await updateContratAvecLogiciels(id, parsed.data, logicielIds);
    await revalide(id);
    await revalide(id, avant);
    return { ok: true, id };
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
