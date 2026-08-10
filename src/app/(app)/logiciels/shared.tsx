import type { FiltresLogiciels } from "@/server/services/logiciels";

// Aides partagées entre la liste, l'export CSV et les fiches. Séparées de
// page.tsx : Next.js interdit d'exporter autre chose que ses champs réservés
// depuis un fichier de page.

/**
 * Convertit les searchParams (URL, non fiables) en filtres typés.
 *
 * `?technologie=` n'y figure plus : la barre ne propose plus ce filtre, et le
 * lire encore aurait laissé un tamis que seule une vieille adresse pouvait
 * poser — invisible à l'écran, mais bien appliqué à la liste comme à l'export.
 * Un tel lien montre désormais l'inventaire entier plutôt qu'une tranche dont
 * rien n'annonce le critère.
 */
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
  if (!criticite) return <span className="badge-muted">Non évaluée</span>;
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

/** Mode d'hébergement tel qu'administré dans Référentiels › Hébergements. */
export type HebergementOption = { cle: string; label: string; couleur: string };

/** Même rendu que le statut : trois clés figées, un habillage administrable. */
export function HebergementBadge({
  hebergement,
  hebergements,
}: {
  hebergement: string;
  hebergements: HebergementOption[];
}) {
  const h = hebergements.find((x) => x.cle === hebergement);
  if (!h) return <span className="badge-muted">{hebergement}</span>;
  const c = h.couleur || "#94a3b8";
  return (
    <span
      className="badge"
      style={{
        color: c,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 35%, transparent)`,
      }}
    >
      {h.label}
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

// La pastille « Utilisation » — « utilisateurs / licences », colorée par le
// verdict — a disparu des deux écrans qui la portaient : la colonne de la liste,
// puis l'en-tête de la fiche. Les deux nombres se lisent dans la carte « Usage
// et coûts » de la fiche, où ils se saisissent. `depassementContrat` reste : il
// alimente la colonne de dépassement de l'export CSV.
