"use server";

import { revalidatePath } from "next/cache";
import {
  consultationSchema,
  contratSchema,
  devisSchema,
  ENVIRONNEMENTS,
  logicielRgpdSchema,
  logicielSchema,
  pieceContratSchema,
} from "@/schemas/logiciel";
import { AUDIT, recordAudit } from "@/server/audit";
import { requireRole } from "@/server/guards";
import * as svc from "@/server/services/logiciels";

type Result = { ok: true; id?: number } | { ok: false; error: string };

function inattendu(e: unknown): Result {
  console.error("[logiciels] erreur inattendue:", e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

function idValide(id: unknown): id is number {
  return Number.isInteger(id) && (id as number) >= 1;
}

/**
 * Refus type des suppressions qui cascaderaient sur des pièces jointes : la
 * cascade PostgreSQL efface les lignes `documents` sans jamais retirer les
 * fichiers du disque, qui resteraient orphelins dans attachments/. Les écrans
 * grisent déjà la corbeille ; cette garde est là parce qu'un bouton désactivé
 * n'engage à rien.
 *
 * `quoi` complète la phrase : « … la pièce jointe DE CE CONTRAT. »
 */
function refusPieces(n: number, quoi: string): Result {
  return {
    ok: false,
    error:
      n === 1
        ? `Supprimez d'abord la pièce jointe ${quoi}.`
        : `Supprimez d'abord les ${n} pièces jointes ${quoi}.`,
  };
}

/** Champs de la fiche principale depuis le FormData. */
function parseFiche(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return logicielSchema.safeParse({
    nom: get("nom"),
    description: get("description"),
    editeurId: get("editeurId"),
    developpementInterne: formData.get("developpementInterne") === "on",
    technologieId: get("technologieId"),
    criticiteId: get("criticiteId"),
    hebergement: get("hebergement"),
    typeSource: get("typeSource"),
    statut: get("statut"),
    versionInstallee: get("versionInstallee"),
    url: get("url"),
    dateMiseEnService: get("dateMiseEnService"),
    authentification: get("authentification"),
    nbUtilisateurs: get("nbUtilisateurs"),
    nbMaxUtilisateurs: get("nbMaxUtilisateurs"),
    referentMetier: get("referentMetier"),
    referentTechnique: get("referentTechnique"),
    coutAnnuel: get("coutAnnuel"),
    finContratLe: get("finContratLe"),
    notes: get("notes"),
  });
}

export async function createLogicielAction(formData: FormData): Promise<Result> {
  await requireRole("admin");
  const parsed = parseFiche(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await svc.createLogiciel(parsed.data);
    revalidatePath("/logiciels");
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateLogicielAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseFiche(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updateLogiciel(id, parsed.data);
    revalidatePath("/logiciels");
    revalidatePath(`/logiciels/${id}`);
    return { ok: true, id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateRgpdAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const parsed = logicielRgpdSchema.safeParse({
    donneesPersonnelles: formData.get("donneesPersonnelles") === "on",
    categoriesDonnees: String(formData.get("categoriesDonnees") ?? ""),
    registreRef: String(formData.get("registreRef") ?? ""),
    localisationDonnees: String(formData.get("localisationDonnees") ?? "inconnue"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updateLogicielRgpd(id, parsed.data);
    revalidatePath(`/logiciels/${id}`);
    return { ok: true, id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function deleteLogicielAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const logiciel = await svc.getLogiciel(id);
  if (!logiciel) return { ok: false, error: "Logiciel introuvable." };
  const pieces = await svc.compterPiecesLogiciel(id);
  if (pieces > 0) return refusPieces(pieces, "de cette fiche, de ses contrats et de ses devis");
  try {
    await svc.deleteLogiciel(id);
  } catch (e) {
    return inattendu(e);
  }
  await recordAudit(AUDIT.LOGICIEL_DELETED, { target: logiciel.nom });
  revalidatePath("/logiciels");
  return { ok: true };
}

// ── Liaisons ──

export async function setServicesAction(logicielId: number, serviceIds: number[]): Promise<Result> {
  await requireRole("admin");
  if (!idValide(logicielId)) return { ok: false, error: "Identifiant invalide." };
  if (!Array.isArray(serviceIds) || !serviceIds.every(idValide)) {
    return { ok: false, error: "Liste de services invalide." };
  }
  try {
    await svc.setServices(logicielId, serviceIds);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

const envValide = (v: unknown): v is (typeof ENVIRONNEMENTS)[number] =>
  typeof v === "string" && (ENVIRONNEMENTS as readonly string[]).includes(v);

export async function addServeurAction(
  logicielId: number,
  serveurId: number,
  environnement: string,
): Promise<Result> {
  await requireRole("admin");
  if (!idValide(logicielId) || !idValide(serveurId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  if (!envValide(environnement)) return { ok: false, error: "Environnement invalide." };
  try {
    await svc.addServeur(logicielId, serveurId, environnement);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2003") {
      return { ok: false, error: "Serveur introuvable (supprimé du référentiel ?)." };
    }
    return inattendu(e);
  }
}

export async function removeServeurAction(
  logicielId: number,
  serveurId: number,
  environnement: string,
): Promise<Result> {
  await requireRole("admin");
  if (!idValide(logicielId) || !idValide(serveurId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  if (!envValide(environnement)) return { ok: false, error: "Environnement invalide." };
  try {
    await svc.removeServeur(logicielId, serveurId, environnement);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function addInterconnexionAction(
  sourceId: number,
  cibleId: number,
  description: string,
): Promise<Result> {
  await requireRole("admin");
  if (!idValide(sourceId) || !idValide(cibleId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  if (sourceId === cibleId) {
    return { ok: false, error: "Un logiciel ne peut pas être interconnecté avec lui-même." };
  }
  const desc = String(description ?? "").trim();
  if (desc.length > 300)
    return { ok: false, error: "Description trop longue (300 caractères max)." };
  try {
    await svc.addInterconnexion(sourceId, cibleId, desc);
    revalidatePath(`/logiciels/${sourceId}`);
    revalidatePath(`/logiciels/${cibleId}`);
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2003") {
      return { ok: false, error: "Logiciel cible introuvable." };
    }
    return inattendu(e);
  }
}

export async function removeInterconnexionAction(id: number, logicielId: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id) || !idValide(logicielId)) return { ok: false, error: "Identifiant invalide." };
  try {
    await svc.removeInterconnexion(id);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

// ── Contrats et marchés ──

function parseContrat(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return contratSchema.safeParse({
    libelle: get("libelle"),
    fournisseurId: get("fournisseurId"),
    referenceMarche: get("referenceMarche"),
    montantAnnuel: get("montantAnnuel"),
    montantMaxi: get("montantMaxi"),
    dateDebut: get("dateDebut"),
    dateFin: get("dateFin"),
    notes: get("notes"),
  });
}

function parsePiece(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return pieceContratSchema.safeParse({
    datePiece: get("datePiece"),
  });
}

export async function createContratAction(logicielId: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(logicielId)) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseContrat(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await svc.createContrat(logicielId, parsed.data);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateContratAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const contrat = await svc.getContrat(id);
  if (!contrat) return { ok: false, error: "Contrat introuvable." };
  const parsed = parseContrat(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updateContrat(id, parsed.data);
    revalidatePath(`/logiciels/${contrat.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function deleteContratAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const contrat = await svc.getContrat(id);
  if (!contrat) return { ok: false, error: "Contrat introuvable." };
  try {
    // Non bloquée par ses pièces : elle emporte lignes et fichiers compris.
    await svc.deleteContrat(id);
    revalidatePath(`/logiciels/${contrat.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function createPieceContratAction(
  contratId: number,
  formData: FormData,
): Promise<Result> {
  await requireRole("admin");
  if (!idValide(contratId)) return { ok: false, error: "Identifiant invalide." };
  const contrat = await svc.getContrat(contratId);
  if (!contrat) return { ok: false, error: "Contrat introuvable." };
  const parsed = parsePiece(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    // L'id est RENVOYÉ : l'écran enchaîne aussitôt le dépôt de la pièce, qui a
    // besoin d'une pièce existante à laquelle se rattacher.
    const created = await svc.createPieceContrat(contratId, parsed.data);
    revalidatePath(`/logiciels/${contrat.logicielId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updatePieceContratAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const piece = await svc.getPieceContrat(id);
  if (!piece) return { ok: false, error: "Pièce introuvable." };
  const parsed = parsePiece(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updatePieceContrat(id, parsed.data);
    revalidatePath(`/logiciels/${piece.contrat.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/** Non bloquée par ses pièces : elle les emporte, fichiers compris. */
export async function deletePieceContratAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const piece = await svc.getPieceContrat(id);
  if (!piece) return { ok: false, error: "Pièce introuvable." };
  try {
    await svc.deletePieceContrat(id);
    revalidatePath(`/logiciels/${piece.contrat.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

// ── Consultations et devis ──

function parseConsultation(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return consultationSchema.safeParse({ objet: get("objet"), date: get("date") });
}

function parseDevis(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return devisSchema.safeParse({
    fournisseurId: get("fournisseurId"),
    montant: get("montant"),
    date: get("date"),
  });
}

export async function createConsultationAction(
  logicielId: number,
  formData: FormData,
): Promise<Result> {
  await requireRole("admin");
  if (!idValide(logicielId)) return { ok: false, error: "Identifiant invalide." };
  const parsed = parseConsultation(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    const created = await svc.createConsultation(logicielId, parsed.data);
    revalidatePath(`/logiciels/${logicielId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateConsultationAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const consultation = await svc.getConsultation(id);
  if (!consultation) return { ok: false, error: "Consultation introuvable." };
  const parsed = parseConsultation(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updateConsultation(id, parsed.data);
    revalidatePath(`/logiciels/${consultation.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/**
 * Refuse tant qu'une pièce jointe pend sous la consultation : la suppression
 * passe par une cascade PostgreSQL, qui efface les lignes `documents` sans
 * jamais retirer les fichiers du disque. Le bouton est déjà grisé côté écran ;
 * la garde est ici parce qu'un bouton désactivé n'engage à rien.
 */
export async function deleteConsultationAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const consultation = await svc.getConsultation(id);
  if (!consultation) return { ok: false, error: "Consultation introuvable." };
  const pieces = await svc.compterPiecesConsultation(id);
  if (pieces > 0) return refusPieces(pieces, "des devis de cette consultation");
  try {
    await svc.deleteConsultation(id);
    revalidatePath(`/logiciels/${consultation.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

export async function createDevisAction(
  consultationId: number,
  formData: FormData,
): Promise<Result> {
  await requireRole("admin");
  if (!idValide(consultationId)) return { ok: false, error: "Identifiant invalide." };
  const consultation = await svc.getConsultation(consultationId);
  if (!consultation) return { ok: false, error: "Consultation introuvable." };
  const parsed = parseDevis(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    // L'id est RENVOYÉ : l'écran enchaîne aussitôt le dépôt de la pièce, qui a
    // besoin d'un devis existant auquel se rattacher.
    const created = await svc.createDevis(consultationId, parsed.data);
    revalidatePath(`/logiciels/${consultation.logicielId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return inattendu(e);
  }
}

export async function updateDevisAction(id: number, formData: FormData): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const devis = await svc.getDevis(id);
  if (!devis) return { ok: false, error: "Devis introuvable." };
  const parsed = parseDevis(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await svc.updateDevis(id, parsed.data);
    revalidatePath(`/logiciels/${devis.consultation.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/**
 * Seule suppression NON bloquée par ses pièces : elle emporte le devis et son
 * fichier ensemble, en passant par deleteDocument (qui retire le fichier du
 * disque) plutôt que par la cascade. Voir deleteDevisAvecPieces.
 */
export async function deleteDevisAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const devis = await svc.getDevis(id);
  if (!devis) return { ok: false, error: "Devis introuvable." };
  try {
    await svc.deleteDevisAvecPieces(id);
    revalidatePath(`/logiciels/${devis.consultation.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}

/** Marque le devis choisi ; démarque automatiquement les autres de la consultation. */
export async function marquerDevisRetenuAction(id: number, retenu: boolean): Promise<Result> {
  await requireRole("admin");
  if (!idValide(id)) return { ok: false, error: "Identifiant invalide." };
  const devis = await svc.getDevis(id);
  if (!devis) return { ok: false, error: "Devis introuvable." };
  try {
    await svc.marquerDevisRetenu(id, retenu === true);
    revalidatePath(`/logiciels/${devis.consultation.logicielId}`);
    return { ok: true };
  } catch (e) {
    return inattendu(e);
  }
}
