import { describe, expect, it } from "vitest";
import { decouperLiens } from "./liens";

describe("decouperLiens", () => {
  it("rend le texte tel quel quand il n'y a pas d'adresse", () => {
    expect(decouperLiens("Dématérialisation des envois.")).toEqual([
      { type: "texte", valeur: "Dématérialisation des envois." },
    ]);
  });

  it("isole les adresses http(s) au fil du texte, retours à la ligne compris", () => {
    const t =
      "Appli : https://kbox.qualigraf.fr\nBack office : https://chatillon.kiosk.qualigraf.fr/";
    expect(decouperLiens(t)).toEqual([
      { type: "texte", valeur: "Appli : " },
      { type: "lien", valeur: "https://kbox.qualigraf.fr", href: "https://kbox.qualigraf.fr" },
      { type: "texte", valeur: "\nBack office : " },
      {
        type: "lien",
        valeur: "https://chatillon.kiosk.qualigraf.fr/",
        href: "https://chatillon.kiosk.qualigraf.fr/",
      },
    ]);
  });

  it("laisse la ponctuation finale au texte", () => {
    expect(decouperLiens("voir https://x.fr. Puis (https://y.fr).")).toEqual([
      { type: "texte", valeur: "voir " },
      { type: "lien", valeur: "https://x.fr", href: "https://x.fr" },
      { type: "texte", valeur: ". Puis (" },
      { type: "lien", valeur: "https://y.fr", href: "https://y.fr" },
      { type: "texte", valeur: ")." },
    ]);
  });

  it("garde une parenthèse fermante qui répond à une ouvrante de l'adresse", () => {
    const u = "https://fr.wikipedia.org/wiki/Nice_(ville)";
    expect(decouperLiens(`cf ${u}.`)).toEqual([
      { type: "texte", valeur: "cf " },
      { type: "lien", valeur: u, href: u },
      { type: "texte", valeur: "." },
    ]);
  });

  it("complète le protocole d'une adresse en www.", () => {
    expect(decouperLiens("www.ville.fr")).toEqual([
      { type: "lien", valeur: "www.ville.fr", href: "https://www.ville.fr" },
    ]);
  });

  it("ne prend pas un mot qui contient www sans point", () => {
    expect(decouperLiens("wwwx")).toEqual([{ type: "texte", valeur: "wwwx" }]);
  });
});
