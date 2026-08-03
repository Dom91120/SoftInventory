"use server";

import { revalidatePath } from "next/cache";
import { assainirNomOriginal, extensionDe } from "@/lib/documents-regles";
import { AUDIT, recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/guards";
import { deleteDocument } from "@/server/services/documents";

type Result = { ok: true; nom?: string } | { ok: false; error: string };

/** Longueur maximale du nom affiché (identique à celle appliquée au dépôt). */
const NOM_MAX = 180;

/**
 * Revalide l'écran qui affiche la pièce jointe. Un document rattaché à une
 * PIÈCE de contrat ou à un DEVIS n'a ni logicielId ni editeurId : il se lit
 * depuis la fiche du logiciel porteur, qu'il faut donc retrouver — sans quoi
 * la page resterait figée après un renommage ou une suppression.
 */
async function revalider(doc: {
  logicielId: number | null;
  editeurId: number | null;
  pieceContratId: number | null;
  devisId: number | null;
}) {
  if (doc.logicielId) revalidatePath(`/logiciels/${doc.logicielId}`);
  if (doc.editeurId) revalidatePath(`/editeurs/${doc.editeurId}`);
  if (doc.pieceContratId) {
    const piece = await prisma.pieceContrat.findUnique({
      where: { id: doc.pieceContratId },
      select: { contrat: { select: { logicielId: true } } },
    });
    if (piece) revalidatePath(`/logiciels/${piece.contrat.logicielId}`);
  }
  if (doc.devisId) {
    const devis = await prisma.devis.findUnique({
      where: { id: doc.devisId },
      select: { consultation: { select: { logicielId: true } } },
    });
    if (devis) revalidatePath(`/logiciels/${devis.consultation.logicielId}`);
  }
}

/**
 * Renomme une pièce jointe (admin). Seul le nom AFFICHÉ change : le fichier
 * reste stocké sous son nom généré (`<uuid>.<ext>`), rien ne bouge sur le
 * disque.
 *
 * L'extension d'origine est RÉIMPOSÉE si l'utilisateur ne la reprend pas :
 * c'est ce nom qui est proposé à l'enregistrement au téléchargement, et un
 * « Guide Concerto » sans « .pdf » arriverait chez l'agent comme un fichier
 * que le système ne sait plus ouvrir.
 */
export async function renameDocumentAction(id: number, nouveauNom: string): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };

  const brut = String(nouveauNom ?? "").trim();
  if (brut === "") return { ok: false, error: "Le nom ne peut pas être vide." };
  if (brut.length > NOM_MAX) {
    return { ok: false, error: `Nom trop long (${NOM_MAX} caractères max).` };
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      logicielId: true,
      editeurId: true,
      pieceContratId: true,
      devisId: true,
      nomOriginal: true,
    },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  // Même assainissement qu'au dépôt : ni séparateurs de chemin, ni caractères
  // de contrôle dans un nom qui repart en en-tête HTTP.
  let nom = assainirNomOriginal(brut);
  const extension = extensionDe(doc.nomOriginal);
  if (extension && extensionDe(nom) !== extension) {
    const base = nom.slice(0, NOM_MAX - extension.length - 1);
    nom = `${base}.${extension}`;
  }

  try {
    await prisma.document.update({ where: { id }, data: { nomOriginal: nom } });
  } catch (e) {
    console.error("[documents] renommage impossible:", e);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
  await revalider(doc);
  return { ok: true, nom };
}

/**
 * Change la catégorie d'une pièce jointe (admin). Les imports en masse la
 * devinent d'après le nom du fichier : il faut pouvoir la corriger à la main.
 * `categorieId` à null = « sans catégorie ».
 */
export async function updateDocumentCategorieAction(
  id: number,
  categorieId: number | null,
): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  if (categorieId !== null && (!Number.isInteger(categorieId) || categorieId < 1)) {
    return { ok: false, error: "Catégorie invalide." };
  }
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { logicielId: true, editeurId: true, pieceContratId: true, devisId: true },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };
  try {
    await prisma.document.update({ where: { id }, data: { categorieId } });
  } catch (e) {
    // La catégorie a pu être supprimée du référentiel entre l'affichage et
    // l'enregistrement : on le dit plutôt que de renvoyer une erreur générique.
    if ((e as { code?: string })?.code === "P2003") {
      return { ok: false, error: "Cette catégorie n'existe plus dans le référentiel." };
    }
    console.error("[documents] changement de catégorie impossible:", e);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
  await revalider(doc);
  return { ok: true };
}

/** Suppression d'une pièce jointe (admin) — la ligne d'abord, le fichier ensuite. */
export async function deleteDocumentAction(id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  try {
    const doc = await deleteDocument(id);
    if (!doc) return { ok: false, error: "Document introuvable." };
    await recordAudit(AUDIT.DOCUMENT_DELETED, { target: doc.nomOriginal });
    await revalider(doc);
    return { ok: true };
  } catch (e) {
    console.error("[documents] suppression impossible:", e);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}
