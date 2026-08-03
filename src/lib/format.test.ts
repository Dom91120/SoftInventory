import { describe, expect, it } from "vitest";
import { formatEuros, formatTel } from "./format";

/**
 * Les séparateurs du format fr-FR sont des espaces INSÉCABLES dont le codet
 * exact dépend de la version d'ICU (U+00A0 ou U+202F selon les versions de
 * Node). On normalise donc avant de comparer : ce qu'on fige ici, c'est le
 * groupement des milliers, les deux décimales et le symbole — pas l'octet
 * qu'ICU choisit pour l'espace.
 */
const normalise = (s: string | null) => s?.replace(/\s/g, " ") ?? null;

describe("formatEuros", () => {
  it("groupe les milliers et impose deux décimales", () => {
    expect(normalise(formatEuros("12400.5"))).toBe("12 400,50 €");
    expect(normalise(formatEuros("15900.00"))).toBe("15 900,00 €");
    expect(normalise(formatEuros("42"))).toBe("42,00 €");
  });

  it("rend null pour un montant non renseigné", () => {
    // Le null dit « rien à afficher » : c'est l'appelant qui met son tiret.
    expect(formatEuros("")).toBeNull();
    expect(formatEuros("   ")).toBeNull();
    expect(formatEuros(null)).toBeNull();
    expect(formatEuros(undefined)).toBeNull();
  });

  it("rend zéro plutôt que null", () => {
    // Un contrat à 0 € est une information (gratuit), pas une absence de saisie.
    expect(normalise(formatEuros("0"))).toBe("0,00 €");
  });

  it("renvoie la valeur brute si elle n'est pas un nombre", () => {
    expect(formatEuros("à négocier")).toBe("à négocier");
  });
});

describe("formatTel", () => {
  it("groupe un numéro à 10 chiffres par paires", () => {
    expect(formatTel("0612345678")).toBe("06 12 34 56 78");
  });

  it("rend la saisie telle quelle si ce n'est pas un 10 chiffres", () => {
    expect(formatTel("+225 0715 299 490")).toBe("+225 0715 299 490");
  });

  it("rend un tiret pour un numéro absent", () => {
    expect(formatTel("")).toBe("—");
    expect(formatTel(null)).toBe("—");
  });
});
