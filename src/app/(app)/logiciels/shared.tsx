import type { FiltresLogiciels } from "@/server/services/logiciels";

// Aides partagées entre la liste, l'export CSV et les fiches. Séparées de
// page.tsx : Next.js interdit d'exporter autre chose que ses champs réservés
// depuis un fichier de page.

/** Convertit les searchParams (URL, non fiables) en filtres typés. */
export function filtresDepuisParams(p: Record<string, string | undefined>): FiltresLogiciels {
  const num = (v?: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 ? n : undefined;
  };
  const parmi = <T extends string>(v: string | undefined, valeurs: readonly T[]): T | undefined =>
    valeurs.includes(v as T) ? (v as T) : undefined;
  return {
    q: p.q?.trim() || undefined,
    editeurId: num(p.editeur),
    serviceId: num(p.service),
    criticiteId: num(p.criticite),
    technologieId: num(p.technologie),
    hebergement: parmi(p.hebergement, ["saas", "on_premise", "hybride"] as const),
    statut: parmi(p.statut, ["evaluation", "production", "fin_de_vie", "abandonne"] as const),
  };
}

/** Badge de criticité coloré depuis le référentiel (pastille style cparfait). */
export function CriticiteBadge({
  criticite,
}: {
  criticite: { label: string; couleur: string } | null;
}) {
  if (!criticite) return <span className="badge-muted">non évaluée</span>;
  const c = criticite.couleur || "#94a3b8";
  return (
    <span
      className="badge"
      style={{
        color: c,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 35%, transparent)`,
      }}
    >
      {criticite.label}
    </span>
  );
}

/** Statut tel qu'administré dans Référentiels › Statuts. */
export type StatutOption = { cle: string; label: string; couleur: string };

/**
 * Badge de statut, colorié depuis le référentiel — même rendu que la criticité.
 * Le repli couvre le cas où la ligne de référentiel manquerait : la fiche
 * affiche alors la clé brute plutôt que rien.
 */
export function StatutBadge({ statut, statuts }: { statut: string; statuts: StatutOption[] }) {
  const s = statuts.find((x) => x.cle === statut);
  if (!s) return <span className="badge-muted">{statut}</span>;
  const c = s.couleur || "#94a3b8";
  return (
    <span
      className="badge"
      style={{
        color: c,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 35%, transparent)`,
      }}
    >
      {s.label}
    </span>
  );
}

/**
 * Plafond dépassé : vrai si le nombre d'utilisateurs réels excède le
 * plafond prévu au contrat. Plafond null = illimité ou non renseigné → rien à
 * comparer, donc jamais de dépassement.
 */
export function depassementContrat(
  nbUtilisateurs: number | null,
  nbMaxUtilisateurs: number | null,
): boolean {
  return (
    nbUtilisateurs !== null && nbMaxUtilisateurs !== null && nbUtilisateurs > nbMaxUtilisateurs
  );
}

/**
 * Pastille « Utilisation » de la liste : « utilisateurs / licences », colorée
 * par le verdict. Utilisateurs non comptés (null) → on ne montre que les
 * licences, sans couleur : il n'y a rien à comparer. Un logiciel réellement à
 * zéro utilisateur affiche « 0 / n » en vert, et se distingue donc bien d'une
 * fiche non renseignée.
 */
export function LicencesBadge({
  nbUtilisateurs,
  nbMaxUtilisateurs,
}: {
  nbUtilisateurs: number | null;
  nbMaxUtilisateurs: number | null;
}) {
  if (nbMaxUtilisateurs === null) return <span className="text-faint">—</span>;

  const licences = `${nbMaxUtilisateurs} licence${nbMaxUtilisateurs > 1 ? "s" : ""} au contrat`;
  if (nbUtilisateurs === null) {
    return (
      <span className="badge-muted tabular-nums" title={`${licences} ; utilisateurs non comptés`}>
        {nbMaxUtilisateurs}
      </span>
    );
  }

  const titre = `${nbUtilisateurs} utilisateur${nbUtilisateurs > 1 ? "s" : ""} pour ${licences}`;
  const classe = depassementContrat(nbUtilisateurs, nbMaxUtilisateurs)
    ? "badge-danger"
    : "badge-ok";
  return (
    <span className={`${classe} tabular-nums`} title={titre}>
      {nbUtilisateurs} / {nbMaxUtilisateurs}
    </span>
  );
}
