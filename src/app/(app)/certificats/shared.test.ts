import { describe, expect, it } from "vitest";
import { pastilleValidite } from "./shared";

/**
 * Ce que dit la colonne « Validité » d'une ligne de certificat. On y fige
 * L'ORDRE DE PRIORITÉ, qui est la seule chose non évidente de cette fonction :
 * ce qu'on a déclaré prime sur ce que la date laisse deviner.
 *
 * Le cas « terme dépassé sur une fiche restée valide » ne se rencontre dans
 * aucune donnée de l'inventaire — les dix-neuf certificats repris courent
 * encore. Il est pourtant la première des trois règles demandées, d'où ce test :
 * c'est le seul endroit où il se vérifie.
 */
describe("pastilleValidite", () => {
  const finLointaine = new Date("2029-05-19T00:00:00.000Z");
  const finPassee = new Date("2020-01-01T00:00:00.000Z");

  it("annonce le compte à rebours en vert tant que le certificat court", () => {
    const p = pastilleValidite({ statut: "valide", dateFin: finLointaine }, 1068);
    expect(p.texte).toBe("dans 1068 j");
    expect(p.classe).toBe("badge-ok");
  });

  it("passe à l'ambre dans les soixante derniers jours", () => {
    expect(pastilleValidite({ statut: "valide", dateFin: finLointaine }, 30).classe).toBe(
      "badge-warn",
    );
  });

  it("dit « Expiré » quand le terme est dépassé, même sur une fiche valide", () => {
    const p = pastilleValidite({ statut: "valide", dateFin: finPassee }, -42);
    expect(p.texte).toBe("Expiré");
    expect(p.classe).toBe("badge-danger");
  });

  it("ne dit « Expiré » que sur la DATE, jamais sur un statut saisi", () => {
    // « Expiré » n'est plus un choix de la liste des statuts : il se déduit.
    // Un terme à venir ne peut donc pas donner « Expiré », quoi qu'on ait mis
    // ailleurs sur la fiche.
    expect(pastilleValidite({ statut: "valide", dateFin: finLointaine }, 1068).texte).toBe(
      "dans 1068 j",
    );
  });

  it("fait primer « Révoqué » sur le compte à rebours", () => {
    const p = pastilleValidite({ statut: "revoque", dateFin: finLointaine }, 1068);
    expect(p.texte).toBe("Révoqué");
    expect(p.classe).toBe("badge-danger");
  });

  it("fait primer « Suspendu », en ambre : le retrait est provisoire", () => {
    const p = pastilleValidite({ statut: "suspendu", dateFin: finLointaine }, 1068);
    expect(p.texte).toBe("Suspendu");
    expect(p.classe).toBe("badge-warn");
  });

  it("fait primer « Révoqué » sur une expiration constatée par la date", () => {
    expect(pastilleValidite({ statut: "revoque", dateFin: finPassee }, -42).texte).toBe("Révoqué");
  });

  it("dit « sans terme » quand la date de fin manque", () => {
    const p = pastilleValidite({ statut: "valide", dateFin: null }, null);
    expect(p.texte).toBe("sans terme");
    expect(p.classe).toBe("badge-muted");
  });
});
