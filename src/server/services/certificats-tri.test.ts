import { describe, expect, it } from "vitest";
import { trierCertificats } from "./certificats";

/**
 * L'ordre de la liste des certificats au clic sur un en-tête. Deux règles y
 * sont figées, les seules qui ne se lisent pas dans le code de l'écran :
 *
 * — « Titulaire » range par NOM puis par PRÉNOM, et non sur ce que la colonne
 *   affiche : `nomTitulaire()` préfixe la civilité, qui aurait rangé toutes les
 *   « Mme » avant tous les « M. » ;
 * — ce qui n'a PAS de valeur ferme la marche dans les deux sens : inverser une
 *   colonne retourne ce qu'elle porte, pas les lignes qui la laissent vide.
 */
const ligne = (
  id: number,
  titulaire: string,
  prenom = "",
  reste: Partial<{
    dateFin: Date | null;
    niveau: string;
    service: { nom: string } | null;
    fournisseur: { nom: string } | null;
  }> = {},
) => ({
  id,
  titulaire,
  prenom,
  dateFin: null,
  niveau: "",
  service: null,
  fournisseur: null,
  ...reste,
});

const noms = (l: Array<{ titulaire: string; prenom: string }>) =>
  l.map((c) => `${c.titulaire} ${c.prenom}`.trim());

describe("trierCertificats", () => {
  it("range le titulaire par nom puis par prénom", () => {
    const lignes = [
      ligne(1, "MARTIN", "Zoé"),
      ligne(2, "AZZAZ", "Nadège"),
      ligne(3, "MARTIN", "Alice"),
    ];
    expect(noms(trierCertificats(lignes, "titulaire", "asc"))).toEqual([
      "AZZAZ Nadège",
      "MARTIN Alice",
      "MARTIN Zoé",
    ]);
  });

  it("retourne les DEUX clés en ordre décroissant", () => {
    const lignes = [ligne(1, "MARTIN", "Alice"), ligne(2, "MARTIN", "Zoé"), ligne(3, "AZZAZ")];
    expect(noms(trierCertificats(lignes, "titulaire", "desc"))).toEqual([
      "MARTIN Zoé",
      "MARTIN Alice",
      "AZZAZ",
    ]);
  });

  it("ignore la civilité, qui n'est pas une clé de tri", () => {
    // Le tri porte sur les champs, pas sur `nomTitulaire()` : « M. BERTIN »
    // reste entre les deux dames.
    const lignes = [
      ligne(1, "CHEVET", "Claire"),
      ligne(2, "BERTIN", "Paul"),
      ligne(3, "AUBRY", "Marie"),
    ];
    expect(noms(trierCertificats(lignes, "titulaire", "asc"))).toEqual([
      "AUBRY Marie",
      "BERTIN Paul",
      "CHEVET Claire",
    ]);
  });

  it("trie la validité sur la date de fin, sans terme en dernier", () => {
    const lignes = [
      ligne(1, "SANS TERME"),
      ligne(2, "TARD", "", { dateFin: new Date("2030-01-01") }),
      ligne(3, "TOT", "", { dateFin: new Date("2026-01-01") }),
    ];
    expect(noms(trierCertificats(lignes, "validite", "asc"))).toEqual([
      "TOT",
      "TARD",
      "SANS TERME",
    ]);
    // Le sens inverse retourne les échéances, mais « sans terme » ne remonte
    // pas en tête pour autant : ce n'est pas une échéance plus lointaine.
    expect(noms(trierCertificats(lignes, "validite", "desc"))).toEqual([
      "TARD",
      "TOT",
      "SANS TERME",
    ]);
  });

  it("départage par titulaire les lignes qu'une colonne laisse à égalité", () => {
    const certinomis = { fournisseur: { nom: "Certinomis" } };
    const lignes = [
      ligne(1, "ZYZAK", "Olivier", certinomis),
      ligne(2, "AGOUDJIL", "Sofiane", certinomis),
      ligne(3, "NOLESINI", "Anne", { fournisseur: { nom: "Chambersign" } }),
    ];
    expect(noms(trierCertificats(lignes, "autorite", "asc"))).toEqual([
      "AGOUDJIL Sofiane",
      "ZYZAK Olivier",
      "NOLESINI Anne",
    ]);
  });

  it("ne touche pas au tableau qu'on lui donne", () => {
    const lignes = [ligne(1, "ZYZAK"), ligne(2, "AGOUDJIL")];
    trierCertificats(lignes, "titulaire", "asc");
    expect(noms(lignes)).toEqual(["ZYZAK", "AGOUDJIL"]);
  });
});
