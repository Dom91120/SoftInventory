// Règles PURES des pièces jointes (testées par documents-regles.test.ts) :
// types admis, taille, nom de stockage, garde de chemin. Aucune I/O ici — le
// service (server/services/documents.ts) applique ces règles au disque.

/** Taille maximale d'une pièce jointe. */
export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024; // 25 Mo

/**
 * Types admis : extension → types MIME acceptés pour elle. Liste BLANCHE
 * (jamais noire) : documents bureautiques, images et archives — pas
 * d'exécutables ni de scripts. La vérification exige que l'extension ET le
 * MIME déclaré concordent : un .exe renommé en .pdf est refusé sur le MIME,
 * un MIME forgé est refusé sur l'extension.
 */
export const TYPES_ADMIS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  odt: ["application/vnd.oasis.opendocument.text"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  odp: ["application/vnd.oasis.opendocument.presentation"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  md: ["text/markdown", "text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** Extension normalisée (minuscules, sans point) du nom de fichier client. */
export function extensionDe(nomFichier: string): string {
  const idx = nomFichier.lastIndexOf(".");
  if (idx <= 0 || idx === nomFichier.length - 1) return "";
  return nomFichier.slice(idx + 1).toLowerCase();
}

export type VerdictFichier = { ok: true; extension: string } | { ok: false; erreur: string };

/** Vérifie nom + MIME déclaré + taille contre la liste blanche. */
export function verifierFichier(nomFichier: string, mime: string, taille: number): VerdictFichier {
  if (taille <= 0) return { ok: false, erreur: "Fichier vide." };
  if (taille > TAILLE_MAX_OCTETS) {
    return { ok: false, erreur: "Fichier trop volumineux (25 Mo maximum)." };
  }
  const ext = extensionDe(nomFichier);
  const admis = ext ? TYPES_ADMIS[ext] : undefined;
  if (!admis) {
    return {
      ok: false,
      erreur:
        "Type de fichier non accepté. Formats admis : PDF, Office (docx, xlsx…), OpenDocument, images (png, jpg), txt/csv/md, zip.",
    };
  }
  // Certains navigateurs envoient un MIME vide ou générique : on l'accepte si
  // l'extension est admise — c'est le couple interdit (ext admise + MIME d'un
  // autre type) qui signale une falsification.
  const mimeNormalise = mime.trim().toLowerCase();
  if (
    mimeNormalise !== "" &&
    mimeNormalise !== "application/octet-stream" &&
    !admis.includes(mimeNormalise)
  ) {
    return { ok: false, erreur: "Le type du fichier ne correspond pas à son extension." };
  }
  return { ok: true, extension: ext };
}

/**
 * Nom affiché assaini : borné, sans caractères de contrôle ni séparateurs de
 * chemin (le nom client n'est JAMAIS utilisé comme chemin, mais il est affiché
 * et repart dans Content-Disposition).
 */
export function assainirNomOriginal(nom: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: retrait volontaire des caractères de contrôle.
  const nettoye = nom.replace(/[\u0000-\u001f"\\/:*?<>|]/g, "_").trim();
  return (nettoye || "document").slice(0, 180);
}

/**
 * Le chemin résolu reste-t-il DANS le répertoire des pièces jointes ?
 * Ceinture et bretelles : `nomStockage` est généré par l'app (<uuid>.<ext>),
 * mais une ligne forgée en base ne doit pas suffire à lire ailleurs.
 */
export function cheminDansRacine(
  racineResolue: string,
  cheminResolu: string,
  sep: string,
): boolean {
  const racine = racineResolue.endsWith(sep) ? racineResolue : racineResolue + sep;
  return cheminResolu.startsWith(racine);
}
