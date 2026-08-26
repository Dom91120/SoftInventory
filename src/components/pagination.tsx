import { ChevronLeft, ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { MemoirePage } from "@/components/memoire-page";
import { cookiePage, pageMemorisee } from "@/lib/memoire-page";

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
 * La page sur laquelle OUVRIR la liste : celle que l'URL demande, ou à défaut
 * celle où on l'avait laissée (voir `MemoirePage`). Appelée par chaque liste
 * paginée, au rendu SERVEUR — c'est là tout l'intérêt : la bonne page part
 * dans la première réponse, au lieu d'être rattrapée après coup dans le
 * navigateur, ce qui se voyait.
 *
 * La mémoire ne parle que sur une URL NUE. `…?statut=production` ou `…?page=2`
 * disent déjà ce qu'ils veulent voir — un lien du tableau de bord, un favori,
 * une adresse partagée, une flèche du pavé. C'est aussi ce qui distingue
 * l'ARRIVÉE sur la liste d'une navigation en son sein : les liens qui feuillettent
 * et les filtres écrivent TOUS `page=…`, page 1 comprise, précisément pour que
 * revenir en tête de liste ne soit pas repris par le souvenir de la page 4.
 *
 * Un numéro devenu trop grand (la liste a maigri) ne montre pas une page vide :
 * `paginer` le ramène dans les bornes.
 */
export async function pageInitiale(
  params: Record<string, string | undefined>,
  chemin: string,
): Promise<number> {
  if (Object.keys(params).length > 0) return pageDepuisParams(params);
  return pageMemorisee((await cookies()).get(cookiePage(chemin))?.value);
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
  // La mémoire de page vit ICI plutôt que dans chaque liste : les trois
  // affichent déjà ce pavé, et il connaît le numéro sans qu'on le lui repasse.
  // Rendue MÊME quand le pavé se tait (une seule page), pour qu'une liste qu'un
  // filtre vient de réduire n'oublie pas où elle en était.
  const memoire = <MemoirePage page={page} />;
  if (pages <= 1) return memoire;

  // `page` est TOUJOURS écrite, la première comprise — là où l'URL la taisait
  // quand elle valait 1. C'est ce qui dit à `pageInitiale` que la page vient
  // d'être choisie : sans elle, revenir en tête de liste rendait l'URL nue, et
  // la mémoire y aurait aussitôt ramené la page qu'on venait de quitter.
  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
    next.set("page", String(p));
    return `?${next.toString()}`;
  };

  const debut = (page - 1) * PAR_PAGE + 1;
  const fin = Math.min(page * PAR_PAGE, total);

  return (
    <>
      {memoire}
      {/* Trois colonnes égales, la troisième vide : les flèches tombent au centre
          EXACT du tableau, quelle que soit la longueur du compte à gauche. Un
          simple `justify-between` les aurait décalées à droite, un `gap` centré
          les aurait décalées de la moitié du compte. */}
      {/* `mt-2` : le pavé appartient au tableau qu'il feuillette, il se tient
          donc plus près de lui que de ce qui viendrait après. */}
      <nav className="mt-2 grid grid-cols-3 items-center" aria-label="Pagination">
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
    </>
  );
}
