import { describe, expect, it } from "vitest";
import {
  ajouterMois,
  dateCalendaire,
  estEnRetard,
  joursAvantEcheance,
  moisDePeriodicite,
  prochaineEcheanceApres,
  rappelDu,
  seuilRappel,
} from "./taches-core";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("ajouterMois — clamp de fin de mois", () => {
  it("31 janvier + 1 mois → 28 février (année non bissextile)", () => {
    expect(ajouterMois(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("31 janvier + 1 mois → 29 février (année bissextile)", () => {
    expect(ajouterMois(d("2028-01-31"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("31 août + 1 mois → 30 septembre", () => {
    expect(ajouterMois(d("2026-08-31"), 1).toISOString().slice(0, 10)).toBe("2026-09-30");
  });
  it("cas ordinaire sans clamp", () => {
    expect(ajouterMois(d("2026-03-15"), 3).toISOString().slice(0, 10)).toBe("2026-06-15");
  });
  it("passage d'année", () => {
    expect(ajouterMois(d("2026-11-30"), 3).toISOString().slice(0, 10)).toBe("2027-02-28");
  });
});

describe("moisDePeriodicite", () => {
  it("valeurs standard", () => {
    expect(moisDePeriodicite("mensuelle", null)).toBe(1);
    expect(moisDePeriodicite("trimestrielle", null)).toBe(3);
    expect(moisDePeriodicite("semestrielle", null)).toBe(6);
    expect(moisDePeriodicite("annuelle", null)).toBe(12);
    expect(moisDePeriodicite("ponctuelle", null)).toBeNull();
  });
  it("personnalisée : intervalle fourni, garde-fou sur valeurs absurdes", () => {
    expect(moisDePeriodicite("personnalisee", 4)).toBe(4);
    expect(moisDePeriodicite("personnalisee", 0)).toBe(12);
    expect(moisDePeriodicite("personnalisee", null)).toBe(12);
    expect(moisDePeriodicite("personnalisee", 500)).toBe(12);
  });
});

describe("prochaineEcheanceApres — ancrage sur l'échéance PRÉVUE", () => {
  it("tâche faite en retard : l'échéance suivante reste calée sur le calendrier", () => {
    // Échéance au 1er juin, complétée le 12 juin : la suivante est le 1er juillet.
    expect(
      prochaineEcheanceApres(d("2026-06-01"), "mensuelle", null, d("2026-06-12"))
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-07-01");
  });
  it("plusieurs occurrences manquées : avance jusqu'à la première future", () => {
    // Mensuelle du 1er janvier, complétée le 20 mars : prochaine = 1er avril,
    // pas trois rattrapages successifs.
    expect(
      prochaineEcheanceApres(d("2026-01-01"), "mensuelle", null, d("2026-03-20"))
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-04-01");
  });
  it("ponctuelle : pas d'échéance suivante", () => {
    expect(prochaineEcheanceApres(d("2026-06-01"), "ponctuelle", null, d("2026-06-01"))).toBeNull();
  });
  it("échéance au 31 janvier, mensuelle : février clampe puis mars retombe au 28", () => {
    // Le clamp N'EST PAS mémorisé : après 31/01 → 28/02, l'occurrence suivante
    // repart du 28 (comportement assumé, documenté ici par le test).
    const fev = prochaineEcheanceApres(d("2026-01-31"), "mensuelle", null, d("2026-01-31"));
    expect(fev?.toISOString().slice(0, 10)).toBe("2026-02-28");
    const mars = prochaineEcheanceApres(fev as Date, "mensuelle", null, d("2026-02-28"));
    expect(mars?.toISOString().slice(0, 10)).toBe("2026-03-28");
  });
  it("échéance égale à aujourd'hui : la prochaine est bien STRICTEMENT future", () => {
    expect(
      prochaineEcheanceApres(d("2026-06-01"), "mensuelle", null, d("2026-07-01"))
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-08-01");
  });
});

describe("estEnRetard / joursAvantEcheance", () => {
  it("échéance aujourd'hui : pas en retard, 0 jour restant", () => {
    expect(estEnRetard(d("2026-06-01"), d("2026-06-01"))).toBe(false);
    expect(joursAvantEcheance(d("2026-06-01"), d("2026-06-01"))).toBe(0);
  });
  it("échéance hier : en retard, -1 jour", () => {
    expect(estEnRetard(d("2026-05-31"), d("2026-06-01"))).toBe(true);
    expect(joursAvantEcheance(d("2026-05-31"), d("2026-06-01"))).toBe(-1);
  });
});

describe("seuilRappel", () => {
  it("valeur propre à la tâche si sensée, sinon défaut global", () => {
    expect(seuilRappel(7, 14)).toBe(7);
    expect(seuilRappel(0, 14)).toBe(0);
    expect(seuilRappel(null, 14)).toBe(14);
    expect(seuilRappel(-3, 14)).toBe(14);
    expect(seuilRappel(9999, 14)).toBe(14);
  });
});

describe("rappelDu — un seul rappel par occurrence", () => {
  it("dans la fenêtre et jamais rappelé → oui", () => {
    expect(rappelDu(d("2026-06-10"), null, null, 14, d("2026-06-01"))).toBe(true);
  });
  it("hors fenêtre → non", () => {
    expect(rappelDu(d("2026-09-01"), null, null, 14, d("2026-06-01"))).toBe(false);
  });
  it("déjà rappelé pour CETTE échéance → non (anti-doublon)", () => {
    expect(rappelDu(d("2026-06-10"), d("2026-06-10"), null, 14, d("2026-06-05"))).toBe(false);
  });
  it("rappelé pour une échéance PRÉCÉDENTE → oui (nouvelle occurrence)", () => {
    expect(rappelDu(d("2026-06-10"), d("2026-05-10"), null, 14, d("2026-06-05"))).toBe(true);
  });
  it("en retard → toujours dans la fenêtre", () => {
    expect(rappelDu(d("2026-05-01"), null, null, 14, d("2026-06-01"))).toBe(true);
  });
  it("seuil spécifique de la tâche prioritaire sur le global", () => {
    // À 9 jours de l'échéance : seuil tâche 7 → pas encore ; global 14 aurait dit oui.
    expect(rappelDu(d("2026-06-10"), null, 7, 14, d("2026-06-01"))).toBe(false);
  });
});

describe("dateCalendaire", () => {
  it("tronque un instant à sa date UTC", () => {
    expect(dateCalendaire(new Date("2026-06-01T15:42:11.000Z")).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });
});
