import { describe, expect, it } from "vitest";
import {
  assainirNomOriginal,
  cheminDansRacine,
  extensionDe,
  TAILLE_MAX_OCTETS,
  verifierFichier,
} from "./documents-regles";

describe("verifierFichier — liste blanche extension + MIME", () => {
  it("accepte un PDF ordinaire", () => {
    expect(verifierFichier("contrat.pdf", "application/pdf", 1024)).toEqual({
      ok: true,
      extension: "pdf",
    });
  });

  it("refuse un exécutable, même avec un MIME anodin", () => {
    const v = verifierFichier("setup.exe", "application/pdf", 1024);
    expect(v.ok).toBe(false);
  });

  it("refuse une extension admise avec le MIME d'un autre type (falsification)", () => {
    const v = verifierFichier("piege.pdf", "application/x-msdownload", 1024);
    expect(v.ok).toBe(false);
  });

  it("tolère un MIME vide ou octet-stream si l'extension est admise", () => {
    expect(verifierFichier("guide.docx", "", 1024).ok).toBe(true);
    expect(verifierFichier("guide.docx", "application/octet-stream", 1024).ok).toBe(true);
  });

  it("refuse au-delà de 25 Mo, accepte juste en dessous", () => {
    expect(verifierFichier("gros.pdf", "application/pdf", TAILLE_MAX_OCTETS + 1).ok).toBe(false);
    expect(verifierFichier("gros.pdf", "application/pdf", TAILLE_MAX_OCTETS).ok).toBe(true);
  });

  it("refuse un fichier vide et un fichier sans extension", () => {
    expect(verifierFichier("contrat.pdf", "application/pdf", 0).ok).toBe(false);
    expect(verifierFichier("sans-extension", "application/pdf", 10).ok).toBe(false);
  });

  it("l'extension est insensible à la casse", () => {
    expect(verifierFichier("SCAN.PDF", "application/pdf", 10).ok).toBe(true);
  });
});

describe("extensionDe", () => {
  it("prend la DERNIÈRE extension (déjoue « rapport.pdf.exe »)", () => {
    expect(extensionDe("rapport.pdf.exe")).toBe("exe");
  });
  it("un nom caché type .htaccess n'a pas d'extension", () => {
    expect(extensionDe(".htaccess")).toBe("");
  });
});

describe("assainirNomOriginal — le nom client est affiché, jamais un chemin", () => {
  it("neutralise séparateurs et caractères réservés", () => {
    expect(assainirNomOriginal("..\\..\\evil<script>.pdf")).not.toMatch(/[\\/<>]/);
  });
  it("borne la longueur et fournit un repli si vide", () => {
    expect(assainirNomOriginal("x".repeat(500)).length).toBeLessThanOrEqual(180);
    expect(assainirNomOriginal("   ")).toBe("document");
  });
});

describe("cheminDansRacine — garde de chemin (ceinture et bretelles)", () => {
  it("accepte un fichier du répertoire", () => {
    expect(cheminDansRacine("C:\\data\\attachments", "C:\\data\\attachments\\a.pdf", "\\")).toBe(
      true,
    );
  });
  it("refuse une évasion par préfixe trompeur", () => {
    // « attachments-evil » commence par « attachments » : le test du séparateur
    // final est ce qui distingue les deux répertoires.
    expect(
      cheminDansRacine("C:\\data\\attachments", "C:\\data\\attachments-evil\\a.pdf", "\\"),
    ).toBe(false);
  });
  it("refuse un chemin remonté hors racine", () => {
    expect(cheminDansRacine("/srv/attachments", "/srv/autre/a.pdf", "/")).toBe(false);
  });
});
