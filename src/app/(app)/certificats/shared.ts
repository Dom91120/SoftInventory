import { LIBELLES_CERTIFICAT, STATUTS_CERTIFICAT, USAGES_CERTIFICAT } from "@/schemas/certificat";
import type { FiltresCertificats } from "@/server/services/certificats";

// Aides partagées entre la liste, l'export CSV et la fiche. Séparées de
// page.tsx : Next.js interdit d'exporter autre chose que ses champs réservés
// depuis un fichier de page.

/** Convertit les searchParams (URL, non fiables) en filtres typés. */
export function filtresDepuisParams(p: Record<string, string | undefined>): FiltresCertificats {
  const num = (v?: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 ? n : undefined;
  };
  const parmi = <T extends string>(v: string | undefined, valeurs: readonly T[]): T | undefined =>
    valeurs.includes(v as T) ? (v as T) : undefined;
  return {
    q: p.q?.trim() || undefined,
    fournisseurId: num(p.fournisseur),
    serviceId: num(p.service),
    statut: parmi(p.statut, STATUTS_CERTIFICAT),
    usage: parmi(p.usage, USAGES_CERTIFICAT),
  };
}

/**
 * Dans combien de jours le certificat expire-t-il ? null quand il n'a pas de
 * date de fin — l'écran dit alors « — » plutôt qu'un nombre inventé.
 *
 * Compté en jours calendaires UTC, comme les tâches : les dates de validité
 * sont des dates, pas des instants, et un décalage horaire ne doit pas faire
 * basculer une échéance d'un jour à l'autre.
 */
export function joursAvantExpiration(dateFin: Date | null, aujourdhui: Date): number | null {
  if (dateFin === null) return null;
  const jour = 24 * 60 * 60 * 1000;
  const a = Date.UTC(dateFin.getUTCFullYear(), dateFin.getUTCMonth(), dateFin.getUTCDate());
  const b = Date.UTC(
    aujourdhui.getUTCFullYear(),
    aujourdhui.getUTCMonth(),
    aujourdhui.getUTCDate(),
  );
  return Math.round((a - b) / jour);
}

/**
 * Comment annoncer l'échéance. Trois régimes seulement — expiré, bientôt, plus
 * tard — et la couleur suit la charte : rouge pour ce qui est dépassé, ambre
 * pour ce qui vient, discret pour le reste.
 *
 * Le seuil de 60 jours n'est pas celui des rappels par e-mail (réglable en
 * Administration) : celui-ci ne fait que colorer une liste qu'on regarde, quand
 * l'autre écrit à quelqu'un. Les confondre obligerait à teindre l'écran au
 * rythme d'un réglage qui ne le concerne pas.
 */
export function tonEcheance(jours: number | null): "danger" | "warn" | "muted" {
  if (jours === null) return "muted";
  if (jours < 0) return "danger";
  return jours <= 60 ? "warn" : "muted";
}

/** Libellé court de l'échéance, pour la pastille des listes. */
export function libelleEcheance(jours: number | null): string {
  if (jours === null) return "sans terme";
  if (jours < 0) return `expiré depuis ${-jours} j`;
  if (jours === 0) return "expire aujourd'hui";
  return `dans ${jours} j`;
}

export { LIBELLES_CERTIFICAT };
