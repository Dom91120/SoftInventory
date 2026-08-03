import { describe, expect, it } from "vitest";
import {
  checkSessionPolicy,
  sessionDeadlineAt,
  shouldTouch,
  TOUCH_THROTTLE_MS,
} from "./session-policy";

// « Maintenant » figé : mercredi 15 juillet 2026, 12 h UTC.
const NOW = new Date("2026-07-15T12:00:00Z").getTime();
const MIN = 60 * 1000;
const H = 60 * MIN;

/** Date située `ms` millisecondes AVANT NOW. */
const ago = (ms: number) => new Date(NOW - ms);

describe("checkSessionPolicy — inactivité par rôle", () => {
  it("admin : actif il y a 29 min → session valide", () => {
    expect(checkSessionPolicy("admin", ago(29 * MIN), ago(H), NOW)).toBe("ok");
  });
  it("admin : inactif depuis 31 min → révoquée", () => {
    expect(checkSessionPolicy("admin", ago(31 * MIN), ago(H), NOW)).toBe("idle");
  });
  it("lecteur : 31 min d'inactivité restent tolérées (seuil à 4 h)", () => {
    expect(checkSessionPolicy("lecteur", ago(31 * MIN), ago(H), NOW)).toBe("ok");
  });
  it("lecteur : inactif depuis 4 h 01 → révoquée", () => {
    expect(checkSessionPolicy("lecteur", ago(4 * H + MIN), ago(5 * H), NOW)).toBe("idle");
  });
});

describe("checkSessionPolicy — plafond absolu", () => {
  it("admin actif en continu : révoquée au-delà de 12 h", () => {
    // Actif à l'instant, mais session ouverte depuis plus de 12 h.
    expect(checkSessionPolicy("admin", ago(MIN), ago(12 * H + MIN), NOW)).toBe("absolute");
  });
  it("admin actif en continu : valide juste avant 12 h", () => {
    expect(checkSessionPolicy("admin", ago(MIN), ago(11 * H), NOW)).toBe("ok");
  });
  it("lecteur actif en continu : révoquée au-delà de 24 h", () => {
    expect(checkSessionPolicy("lecteur", ago(MIN), ago(24 * H + MIN), NOW)).toBe("absolute");
  });
  it("le plafond absolu prime sur l'inactivité (diagnostic le plus fort)", () => {
    // Les DEUX limites sont dépassées : on renvoie « absolute ».
    expect(checkSessionPolicy("admin", ago(2 * H), ago(13 * H), NOW)).toBe("absolute");
  });
});

describe("checkSessionPolicy — rôle absent ou inconnu", () => {
  it("rôle indéfini → repli sur le rôle le MOINS privilégié (lecteur)", () => {
    expect(checkSessionPolicy(undefined, ago(2 * H), ago(3 * H), NOW)).toBe("ok");
    expect(checkSessionPolicy(undefined, ago(5 * H), ago(6 * H), NOW)).toBe("idle");
  });
});

describe("sessionDeadlineAt — réveil du composant de surveillance", () => {
  it("admin : échéance = dernière activité + 30 min", () => {
    const lastSeen = ago(5 * MIN);
    expect(sessionDeadlineAt("admin", lastSeen, ago(H))).toBe(lastSeen.getTime() + 30 * MIN);
  });
  it("lecteur : échéance = dernière activité + 4 h", () => {
    const lastSeen = ago(5 * MIN);
    expect(sessionDeadlineAt("lecteur", lastSeen, ago(H))).toBe(lastSeen.getTime() + 4 * H);
  });
  it("le plafond absolu l'emporte quand il tombe en premier", () => {
    // Session ouverte il y a 11 h 50 (plafond 12 h) : le plafond échoit dans 10 min,
    // avant l'inactivité (30 min à partir de maintenant).
    const created = ago(11 * H + 50 * MIN);
    const lastSeen = new Date(NOW);
    expect(sessionDeadlineAt("admin", lastSeen, created)).toBe(created.getTime() + 12 * H);
  });
  it("échéance cohérente avec le verdict : ok juste avant, idle juste après", () => {
    const lastSeen = ago(5 * MIN);
    const created = ago(H);
    const d = sessionDeadlineAt("admin", lastSeen, created);
    expect(checkSessionPolicy("admin", lastSeen, created, d - 1000)).toBe("ok");
    expect(checkSessionPolicy("admin", lastSeen, created, d + 1000)).toBe("idle");
  });
});

describe("shouldTouch — throttle des écritures d'activité", () => {
  it("activité récente → pas de réécriture", () => {
    expect(shouldTouch(ago(TOUCH_THROTTLE_MS - 1000), NOW)).toBe(false);
  });
  it("throttle écoulé → réécriture", () => {
    expect(shouldTouch(ago(TOUCH_THROTTLE_MS + 1000), NOW)).toBe(true);
  });
});
