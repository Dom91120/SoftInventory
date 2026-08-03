import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { documentPath, getDocument } from "@/server/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Types que l'on accepte d'AFFICHER dans le navigateur (`?inline=1`). Liste
 * blanche délibérément courte : ce sont des formats passifs, rendus par des
 * visionneuses isolées. Ni HTML ni SVG — ils ne sont de toute façon pas admis
 * au dépôt, mais l'oubli d'un jour ne doit pas ouvrir une faille XSS ici. Les
 * formats bureautiques et les archives restent en pièce jointe : le navigateur
 * les téléchargerait de toute manière.
 */
const AFFICHABLES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
]);

/**
 * Téléchargement d'une pièce jointe PAR ID : la ligne en base est la seule
 * porte d'accès (aucun chemin ni nom de fichier accepté du client). Le lecteur
 * y a droit — consulter les documents fait partie de la consultation.
 *
 * `?inline=1` demande l'affichage dans le navigateur plutôt que l'enregistrement.
 */
export function GET(request: Request): Promise<Response> {
  return reponseApi(async () => {
    await requireRoleApi("lecteur", "/api/documents/download");

    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    const doc = await getDocument(id);
    if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });

    const chemin = documentPath(doc);
    try {
      await stat(chemin);
    } catch {
      return NextResponse.json(
        { error: "Fichier absent du stockage (signalez-le à un administrateur)." },
        { status: 404 },
      );
    }

    // Flux plutôt que lecture en mémoire : un zip de 25 Mo ne doit pas être
    // chargé entier par requête.
    const stream = Readable.toWeb(createReadStream(chemin)) as ReadableStream;

    // Nom du fichier proposé à l'enregistrement. Un en-tête HTTP n'est PAS en
    // UTF-8 : y écrire « avancés » tel quel le fait arriver en « avancÃ©s »
    // chez le client. On donne donc les DEUX formes prévues par la RFC 6266 —
    // `filename` réduit à l'ASCII pour les clients anciens, et `filename*` en
    // UTF-8 percent-encodé, que tous les navigateurs actuels préfèrent.
    // Le nom est déjà assaini au dépôt ; on neutralise ici guillemets et
    // retours à la ligne, qui casseraient la structure de l'en-tête.
    const nom = doc.nomOriginal.replace(/["\r\n]/g, "_");
    const nomAscii = nom.replace(/[^\x20-\x7e]/g, "_");

    // L'affichage n'est accordé que si le TYPE le permet : demander `inline=1`
    // sur un .docx ou un .zip retombe sur le téléchargement.
    const veutAffichage = new URL(request.url).searchParams.get("inline") === "1";
    const affiche = veutAffichage && AFFICHABLES.has(doc.mime);
    const disposition = `${affiche ? "inline" : "attachment"}; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;

    return new Response(stream, {
      headers: {
        "Content-Type": doc.mime,
        "Content-Length": String(doc.taille),
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        // Contenu déposé par un utilisateur, rendu dans NOTRE origine : la
        // directive `sandbox` le prive de scripts, de formulaires et de
        // navigation. Un PDF peut embarquer du JavaScript ; il est ici inerte.
        ...(affiche ? { "Content-Security-Policy": "sandbox" } : {}),
      },
    });
  });
}
