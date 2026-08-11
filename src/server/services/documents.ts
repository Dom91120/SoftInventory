import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Document } from "@/generated/prisma/client";
import { assainirNomOriginal, cheminDansRacine, verifierFichier } from "@/lib/documents-regles";
import { prisma } from "@/server/db";

// Pièces jointes : fichiers sur disque (ATTACHMENTS_DIR), métadonnées en base.
// La ligne en base est la SEULE porte d'accès (téléchargement par id) ; le nom
// de stockage est généré (<uuid>.<ext>) — jamais le nom client.

function racineAttachments(): string {
  return path.resolve(process.env.ATTACHMENTS_DIR || path.join(process.cwd(), "attachments"));
}

/** Chemin absolu d'un document, gardé DANS la racine (ceinture et bretelles). */
export function documentPath(doc: Pick<Document, "nomStockage">): string {
  const racine = racineAttachments();
  const chemin = path.resolve(racine, doc.nomStockage);
  if (!cheminDansRacine(racine, chemin, path.sep)) {
    throw new Error(`Chemin de document hors racine: ${doc.nomStockage}`);
  }
  return chemin;
}

export type ParentDocument =
  | { logicielId: number }
  | { editeurId: number }
  | { pieceContratId: number }
  | { devisId: number }
  | { certificatId: number };

/**
 * Enregistre une pièce jointe : vérifie la liste blanche, écrit le fichier
 * sous un nom généré, crée la ligne. Si l'écriture de la ligne échoue, le
 * fichier orphelin est supprimé (best-effort).
 */
export async function saveDocument(opts: {
  parent: ParentDocument;
  categorieId: number | null;
  nomOriginal: string;
  mime: string;
  contenu: Buffer;
  deposePar: { id: string; label: string } | null;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const verdict = verifierFichier(opts.nomOriginal, opts.mime, opts.contenu.byteLength);
  if (!verdict.ok) return { ok: false, error: verdict.erreur };

  // Parent vérifié AVANT d'écrire quoi que ce soit sur le disque.
  if ("logicielId" in opts.parent) {
    const l = await prisma.logiciel.findUnique({
      where: { id: opts.parent.logicielId },
      select: { id: true },
    });
    if (!l) return { ok: false, error: "Logiciel introuvable." };
  } else if ("editeurId" in opts.parent) {
    const e = await prisma.editeur.findUnique({
      where: { id: opts.parent.editeurId },
      select: { id: true },
    });
    if (!e) return { ok: false, error: "Éditeur introuvable." };
  } else if ("pieceContratId" in opts.parent) {
    const c = await prisma.pieceContrat.findUnique({
      where: { id: opts.parent.pieceContratId },
      select: { id: true },
    });
    if (!c) return { ok: false, error: "Pièce de contrat introuvable." };
  } else if ("certificatId" in opts.parent) {
    const c = await prisma.certificat.findUnique({
      where: { id: opts.parent.certificatId },
      select: { id: true },
    });
    if (!c) return { ok: false, error: "Certificat introuvable." };
  } else {
    const d = await prisma.devis.findUnique({
      where: { id: opts.parent.devisId },
      select: { id: true },
    });
    if (!d) return { ok: false, error: "Devis introuvable." };
  }

  const nomStockage = `${randomUUID()}.${verdict.extension}`;
  const racine = racineAttachments();
  await mkdir(racine, { recursive: true });
  const chemin = path.resolve(racine, nomStockage);
  await writeFile(chemin, opts.contenu, { flag: "wx" });

  try {
    const doc = await prisma.document.create({
      data: {
        ...opts.parent,
        categorieId: opts.categorieId,
        nomOriginal: assainirNomOriginal(opts.nomOriginal),
        nomStockage,
        mime: opts.mime || "application/octet-stream",
        taille: opts.contenu.byteLength,
        deposeParId: opts.deposePar?.id ?? null,
        deposeParLabel: opts.deposePar?.label ?? "",
      },
    });
    return { ok: true, id: doc.id };
  } catch (e) {
    // Ligne non créée → le fichier ne doit pas rester orphelin.
    await unlink(chemin).catch(() => {});
    throw e;
  }
}

export function getDocument(id: number) {
  return prisma.document.findUnique({ where: { id }, include: { categorie: true } });
}

/**
 * Supprime la ligne PUIS le fichier (best-effort) : une ligne sans fichier est
 * un 404 propre, un fichier sans ligne est invisible — l'ordre inverse pourrait
 * laisser un document listé mais introuvable.
 */
export async function deleteDocument(id: number): Promise<Document | null> {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return null;
  await prisma.document.delete({ where: { id } });
  try {
    await unlink(documentPath(doc));
  } catch (e) {
    console.error("[documents] fichier non supprimé (ligne effacée):", doc.nomStockage, e);
  }
  return doc;
}
