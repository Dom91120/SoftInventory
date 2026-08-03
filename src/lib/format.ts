/**
 * Initiales d'un usager pour la pastille de la barre : 2 premières initiales du nom
 * (« Marie Curie » → « MC »), sinon 2 premières lettres du mot unique, sinon 1re lettre
 * de l'e-mail. Source unique des deux shells (connecté / usager).
 */
export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return (email[0] || "?").toUpperCase();
}

/** Formate une Date (ou null) en "YYYY-MM-DD" pour un <input type="date">. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** Date courte fr-FR "JJ/MM/AAAA" — source unique (7 copies avant l'audit 2026-07-18). */
export const DATE_FMT_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Idem, ancrée en UTC (dates `@db.Date`, sans dérive de fuseau à l'affichage). */
export const DATE_FMT_FR_UTC = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** Date + heure fr-FR "JJ/MM/AAAA HH:MM". */
export const DATETIME_FMT_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Montant en euros, centimes compris : "12 400,50 €". */
const EUROS_FMT_FR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formate un montant pour l'AFFICHAGE. L'entrée est un Decimal Prisma sérialisé
 * ("12400.5") ; "" ou null = non renseigné, d'où le null en retour que
 * l'appelant remplace par son propre tiret.
 *
 * À ne PAS utiliser pour la valeur d'un champ de saisie : le séparateur de
 * milliers y compliquerait la relecture, alors que `montantOptionnel` (schemas/
 * logiciel) sait de toute façon relire une saisie à la française.
 */
export function formatEuros(montant: string | null | undefined): string | null {
  if (montant === null || montant === undefined || montant.trim() === "") return null;
  const n = Number(montant);
  // Valeur inattendue (jamais vu depuis la base, mais l'entrée est une chaîne) :
  // on la montre telle quelle plutôt que d'afficher « NaN € ».
  if (!Number.isFinite(n)) return montant;
  return EUROS_FMT_FR.format(n);
}

/**
 * Comparateur alphabétique fr-FR, insensible à la casse et aux accents (ils ne
 * départagent que les homographes : « adobe » avant « Zoom », « elan » collé à
 * « Élan »).
 *
 * PostgreSQL trie avec la collation du serveur, et l'image `postgres:alpine`
 * (musl) trie en réalité par octets — « Zoom » AVANT « adobe ». Les listes
 * affichées trient donc côté application, pour un ordre identique quelle que
 * soit la collation de la base.
 */
export const compareAlpha = new Intl.Collator("fr").compare;

/**
 * Saisie d'un NOM de famille : forcée en majuscules à la frappe (convention
 * « NOM Prénom » de l'application). Posée en `onInput` sur un champ NON contrôlé
 * (inscription, mon compte) ; un champ contrôlé passe simplement sa valeur par
 * `toUpperCase()` dans son `onChange`. La position du curseur est restaurée —
 * la casse ne change pas la longueur, une saisie au milieu du mot reste possible.
 */
export function upperCaseOnInput(e: React.FormEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  const upper = el.value.toUpperCase();
  if (upper === el.value) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = upper;
  if (start !== null && end !== null) el.setSelectionRange(start, end);
}

/**
 * Formate un numéro de téléphone FR en groupes de 2 chiffres : "06 12 34 56 78".
 * Renvoie "—" si vide, ou la valeur brute si ce n'est pas un 10 chiffres.
 * (Réimplémente formatTel du legacy public/js/app.js.)
 */
export function formatTel(tel: string | null | undefined): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length !== 10) return tel;
  return (d.match(/.{2}/g) ?? []).join(" ");
}
