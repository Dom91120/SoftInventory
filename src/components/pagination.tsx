import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/** Éléments par page, commun aux trois listes. */
export const PAR_PAGE = 10;

/**
 * Découpe une liste déjà triée et filtrée. Le tri se fait en mémoire (voir
 * `compareAlpha` et `ordonner`), on pagine donc AUSSI en mémoire : demander la
 * tranche à PostgreSQL donnerait un autre ordre que celui affiché.
 *
 * Les listes de l'inventaire se comptent en dizaines ; le jour où elles se
 * compteraient en dizaines de milliers, c'est le tri qu'il faudrait descendre
 * en base, la pagination suivrait.
 *
 * `page` hors bornes est ramenée dans les bornes plutôt que refusée : une URL
 * bricolée ou un filtre qui vient de réduire la liste montrent la dernière page
 * existante, pas une page vide.
 */
export function paginer<T>(tout: T[], pageDemandee: number | undefined) {
  const pages = Math.max(1, Math.ceil(tout.length / PAR_PAGE));
  const page = Math.min(Math.max(1, pageDemandee ?? 1), pages);
  const debut = (page - 1) * PAR_PAGE;
  return { page, pages, total: tout.length, elements: tout.slice(debut, debut + PAR_PAGE) };
}

/** Numéro de page lu depuis l'URL ; tout ce qui n'est pas un entier ≥ 1 vaut 1. */
export function pageDepuisParams(p: Record<string, string | undefined>): number {
  const n = Number(p.page);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * Pavé de pagination : « 11–20 sur 56 » et les deux flèches. Composant SERVEUR —
 * les liens portent la query string courante, page comprise, si bien qu'un
 * filtre actif survit au changement de page (et réciproquement, changer un
 * filtre remet à la page 1 : voir `BarreListe`).
 */
export function Pagination({
  page,
  pages,
  total,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  /** Query string courante, hors `page`. */
  params: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  };

  const debut = (page - 1) * PAR_PAGE + 1;
  const fin = Math.min(page * PAR_PAGE, total);

  return (
    // Trois colonnes égales, la troisième vide : les flèches tombent au centre
    // EXACT du tableau, quelle que soit la longueur du compte à gauche. Un
    // simple `justify-between` les aurait décalées à droite, un `gap` centré les
    // aurait décalées de la moitié du compte.
    <nav className="mt-3 grid grid-cols-3 items-center" aria-label="Pagination">
      <span className="justify-self-start text-xs text-muted tabular-nums">
        {debut}–{fin} sur {total}
      </span>
      <span className="flex items-center gap-1 justify-self-center">
        {/* Une flèche inactive reste AFFICHÉE mais n'est plus un lien : le pavé
            ne change pas de largeur d'une page à l'autre. */}
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary !px-2.5" title="Page précédente">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="btn-secondary !px-2.5 opacity-40" aria-hidden>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <span className="px-2 text-xs text-muted tabular-nums">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className="btn-secondary !px-2.5" title="Page suivante">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="btn-secondary !px-2.5 opacity-40" aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </span>
    </nav>
  );
}
