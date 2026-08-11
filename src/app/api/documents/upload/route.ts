import { NextResponse } from "next/server";
import { TAILLE_MAX_OCTETS } from "@/lib/documents-regles";
import { AUDIT, recordAudit } from "@/server/audit";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { saveDocument } from "@/server/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dépôt d'une pièce jointe (multipart/form-data) : fichier + parent
 * (logicielId, editeurId, pieceContratId, devisId OU certificatId) + catégorie
 * optionnelle. Réservé aux admins. Route API plutôt que server action : flux
 * binaire + FormData volumineux.
 */
export function POST(request: Request): Promise<Response> {
  return reponseApi(async () => {
    const session = await requireRoleApi("admin", "/api/documents/upload");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }
    // Refus AVANT lecture du contenu : ne pas allouer 500 Mo pour les refuser.
    if (file.size > TAILLE_MAX_OCTETS) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (25 Mo maximum)." },
        { status: 413 },
      );
    }

    const id = (champ: string) => {
      const n = Number(form.get(champ));
      return Number.isInteger(n) && n >= 1 ? n : null;
    };
    const logicielId = id("logicielId");
    const editeurId = id("editeurId");
    const pieceContratId = id("pieceContratId");
    const devisId = id("devisId");
    const certificatId = id("certificatId");
    const parent = logicielId
      ? { logicielId }
      : editeurId
        ? { editeurId }
        : pieceContratId
          ? { pieceContratId }
          : devisId
            ? { devisId }
            : certificatId
              ? { certificatId }
              : null;
    if (!parent) {
      return NextResponse.json({ error: "Parent du document manquant." }, { status: 400 });
    }

    const categorieRaw = Number(form.get("categorieId"));
    const categorieId = Number.isInteger(categorieRaw) && categorieRaw >= 1 ? categorieRaw : null;

    const contenu = Buffer.from(await file.arrayBuffer());
    const res = await saveDocument({
      parent,
      categorieId,
      nomOriginal: file.name,
      mime: file.type,
      contenu,
      deposePar: { id: session.user.id, label: session.user.email },
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

    await recordAudit(AUDIT.DOCUMENT_UPLOADED, {
      target: file.name,
      details: { ...parent, taille: file.size },
    });
    return NextResponse.json({ ok: true, id: res.id });
  });
}
