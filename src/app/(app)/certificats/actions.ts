"use server";

import { revalidatePath } from "next/cache";
import { certificatSchema, codesCertificatSchema } from "@/schemas/certificat";
import { requireRole } from "@/server/guards";
import {
  createCertificat,
  deleteCertificat,
  getCertificat,
  getCodesCertificat,
  updateCertificat,
  updateCodesCertificat,
} from "@/server/services/certificats";

type Result = { ok: true; id?: number } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[certificats] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

/**
 * Les champs de la fiche, et eux seuls. Les deux codes de l'autorité n'y sont
 * PAS : ils ont leur propre formulaire et leur propre action. Les faire
 * transiter ici les aurait effacés à chaque enregistrement d'un compte qui ne
 * les reçoit pas — un lecteur n'a pas les champs, `FormData` n'aurait rien
 * porté, et l'écriture aurait vidé la base.
 */
function parse(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return certificatSchema.safeParse({
    civilite: get("civilite"),
    titulaire: get("titulaire"),
    prenom: get("prenom"),
    fonction: get("fonction"),
    email: get("email"),
    fournisseurId: get("fournisseurId"),
    serviceId: get("serviceId"),
    serveurId: get("serveurId"),
    usage: get("usage"),
    support: get("support"),
    niveau: get("niveau"),
    numeroSerie: get("numeroSerie"),
    dateDebut: get("dateDebut"),
    dateFin: get("dateFin"),
    dureeAnnees: get("dureeAnnees"),
    montantTtc: get("montantTtc"),
    imputation: get("imputation"),
    bonCommandeLe: get("bonCommandeLe"),
    bonCommandeNote: get("bonCommandeNote"),
    statut: get("statut"),
    notes: get("notes"),
  });
}

function revalide(id?: number) {
  revalidatePath("/certificats");
  revalidatePath("/tableau-de-bord");
  if (id) revalidatePath(`/certificats/${id}`);
}

export async function createCertificatAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await createCertificat(parsed.data);
    revalide(created.id);
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateCertificatAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  if (!(await getCertificat(id))) return { ok: false, error: "Certificat introuvable." };
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await updateCertificat(id, parsed.data);
    revalide(id);
    return { ok: true, id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function deleteCertificatAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  if (!(await getCertificat(id))) return { ok: false, error: "Certificat introuvable." };
  try {
    await deleteCertificat(id);
    revalide(id);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/**
 * Les deux codes de l'autorité, à la DEMANDE et pour les seuls admins.
 *
 * Ils ne partent pas avec le rendu de la fiche : tant que personne ne clique,
 * ils ne quittent pas la base. Un secret qu'on n'a pas envoyé est un secret qui
 * ne traîne ni dans le HTML d'un onglet resté ouvert, ni dans le cache.
 */
export async function lireCodesAction(
  id: number,
): Promise<
  { ok: true; codeRevocation: string; codeRetrait: string } | { ok: false; error: string }
> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  try {
    const codes = await getCodesCertificat(id);
    if (!codes) return { ok: false, error: "Certificat introuvable." };
    return { ok: true, ...codes };
  } catch (e) {
    return inattendu(e) as { ok: false; error: string };
  }
}

export async function updateCodesAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  if (!(await getCertificat(id))) return { ok: false, error: "Certificat introuvable." };
  const parsed = codesCertificatSchema.safeParse({
    codeRevocation: String(formData.get("codeRevocation") ?? ""),
    codeRetrait: String(formData.get("codeRetrait") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await updateCodesCertificat(id, parsed.data);
    revalide(id);
    return { ok: true, id };
  } catch (e) {
    return inattendu(e);
  }
}
