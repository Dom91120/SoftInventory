import type { StatutCertificat } from "@/generated/prisma/enums";
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
 * Comment annoncer l'échéance, et la couleur suit la charte : rouge pour ce
 * qui est dépassé, ambre pour ce qui vient, VERT pour ce qui court encore
 * largement — le même vert que « Valide », puisque c'est la même nouvelle.
 *
 * Le gris reste pour le SANS TERME : une date de fin absente n'est pas une
 * bonne nouvelle, c'est une inconnue, et la teindre en vert dirait le
 * contraire de ce qu'on sait.
 *
 * Le seuil de 60 jours n'est pas celui des rappels par e-mail (réglable en
 * Administration) : celui-ci ne fait que colorer une liste qu'on regarde, quand
 * l'autre écrit à quelqu'un. Les confondre obligerait à teindre l'écran au
 * rythme d'un réglage qui ne le concerne pas.
 */
export function tonEcheance(jours: number | null): "danger" | "warn" | "ok" | "muted" {
  if (jours === null) return "muted";
  if (jours < 0) return "danger";
  return jours <= 60 ? "warn" : "ok";
}

/**
 * La couleur d'un statut. UNE seule table, partagée par la pastille de
 * l'en-tête de fiche et celle de la liste : « révoqué » et « expiré »
 * partagent le rouge parce qu'ils disent la même chose de l'usage — ce
 * certificat ne sert plus —, et se distinguent par le mot, pas par la
 * teinte. « Suspendu » est ambre : c'est un retrait provisoire.
 *
 * Seules les COULEURS sont ici ; les libellés viennent de
 * `LIBELLES_CERTIFICAT`, qui les donne déjà au formulaire, au filtre et à
 * l'export.
 */
export const COULEUR_STATUT: Record<StatutCertificat, string> = {
  valide: "badge-ok",
  suspendu: "badge-warn",
  revoque: "badge-danger",
};

/**
 * L'état EXPIRÉ, qui n'est pas un statut : il se lit de la date de fin. Son
 * libellé et sa couleur vivent donc ici, avec le calcul qui le produit, et
 * non dans les tables des valeurs qu'on saisit. Le rouge est celui de
 * « révoqué » — les deux disent la même chose de l'usage, et c'est le mot qui
 * les distingue.
 */
const EXPIRE = { texte: "Expiré", classe: "badge-danger" } as const;

/**
 * Ce que dit la colonne « Validité » d'une ligne : un ÉTAT quand il y en a
 * un à dire, le compte à rebours sinon.
 *
 * L'ordre n'est pas indifférent. Ce qu'on a DÉCLARÉ prime sur ce que la date
 * laisse deviner : un certificat révoqué ou suspendu l'a été par quelqu'un,
 * et annoncer « dans 1068 j » sur une pièce qu'on a mise hors d'usage serait
 * répondre à côté. L'expiration, elle, ne se déclare pas : elle se CONSTATE
 * sur la date de fin, et c'est pourquoi elle n'est plus un choix de la liste
 * des statuts — une fiche restée « valide » dont le terme est franchi est
 * expirée, qu'on l'ait dit ou non.
 *
 * La pastille porte TOUJOURS l'horloge, quel que soit ce qu'elle dit : elle
 * marque la colonne « Validité » du même signe d'un bout à l'autre, et une
 * ligne sur deux qui la perdait faisait sautiller le regard.
 */
export function pastilleValidite(
  c: { statut: StatutCertificat; dateFin: Date | null },
  jours: number | null,
): { texte: string; classe: string } {
  const etat = (cle: StatutCertificat) => ({
    texte: LIBELLES_CERTIFICAT.statut[cle],
    classe: COULEUR_STATUT[cle],
  });
  if (c.statut === "revoque") return etat("revoque");
  if (c.statut === "suspendu") return etat("suspendu");
  if (jours !== null && jours < 0) return { ...EXPIRE };
  return { texte: libelleEcheance(jours), classe: `badge-${tonEcheance(jours)}` };
}

/** Libellé court de l'échéance, pour la pastille des listes. */
export function libelleEcheance(jours: number | null): string {
  if (jours === null) return "sans terme";
  if (jours < 0) return `expiré depuis ${-jours} j`;
  if (jours === 0) return "expire aujourd'hui";
  return `dans ${jours} j`;
}

export { LIBELLES_CERTIFICAT };
