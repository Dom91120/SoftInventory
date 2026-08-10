"use client";

import { Download, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import type { Option } from "./fiche-form";

/**
 * Barre de filtres de l'inventaire, pilotée par l'URL (searchParams) : les
 * filtres sont rechargeables, partageables, et l'export CSV reprend la même
 * query string — ce qu'on voit est ce qu'on exporte.
 */
export function FiltresBar({
  editeurs,
  services,
  criticites,
  statuts,
  hebergements,
}: {
  editeurs: Option[];
  services: Option[];
  criticites: Option[];
  /** Statuts du référentiel : libellés administrables, clés figées. */
  statuts: Array<{ cle: string; label: string }>;
  /** Modes d'hébergement du référentiel : mêmes clés figées, libellés administrables. */
  hebergements: Array<{ cle: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  /**
   * Le champ de recherche est NON CONTRÔLÉ — sa valeur vit dans le DOM, pas
   * dans un état React — pour que la frappe n'attende pas un aller-retour par
   * l'URL à chaque touche. Il faut donc le vider à la main : vider la query
   * string relance bien la liste sans filtre, mais laisse le texte à l'écran,
   * et le champ affirme alors un filtre qui ne s'applique plus.
   */
  const recherche = useRef<HTMLInputElement>(null);

  function effacerTout() {
    if (recherche.current) recherche.current.value = "";
    router.replace(pathname);
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Retour à la première page : après un filtre, la page 4 n'existe souvent
    // plus, et l'utilisateur attend le début des résultats, pas leur milieu.
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  /**
   * `page` vit dans la même query string mais ne restreint rien : sans cette
   * exception, « Effacer » s'allumerait sur une simple page 2 et proposerait
   * d'effacer ce que l'on n'a pas posé. Même règle que `BarreListe`.
   */
  const actif = [...params.keys()].some((k) => k !== "page");

  const sel = (key: string, label: string, options: Array<{ value: string; label: string }>) => (
    <select
      aria-label={label}
      className="input select-filtre !w-auto"
      value={params.get(key) ?? ""}
      onChange={(e) => setParam(key, e.target.value)}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const refOptions = (list: Option[]) => list.map((o) => ({ value: String(o.id), label: o.label }));

  /**
   * À partir de quelle place la barre tient-elle sur UNE rangée ?
   *
   * D'un seul tenant elle demande 14 rem de recherche, 32 rem de listes, 8 rem
   * d'export et les gouttières : 55,5 rem. Le bouton « Effacer » en ajoute 6,
   * d'où le second seuil — les deux disent la même chose, la largeur qu'il faut
   * à ce qui est réellement affiché. La colonne de contenu, large de 68 rem au
   * plus, offre l'un comme l'autre : la barre tient sur une rangée même une fois
   * filtrée, et ne se dédouble que sur une fenêtre étroite.
   *
   * Les deux valeurs collent au besoin mesuré à 5 px près, il n'y a pas de gras
   * à retirer : ce sont les 22 rem de recherche et d'export encadrant les listes
   * qui décident du reste. Les forcer sur une rangée en deçà ne ferait que
   * replier les listes en escalier au milieu, la recherche flottant à mi-hauteur
   * à côté. Une liste montre d'ailleurs l'option CHOISIE, plus large parfois que
   * son libellé (« Production » pour « Statut ») : le besoin exact dépend donc
   * de ce qui est filtré, et aucun seuil ne saurait le suivre au pixel.
   *
   * Le seuil se lit sur la place DISPONIBLE (`@container`) et non sur la
   * fenêtre : la sidebar se replie sous 1000 px et rend d'un coup 200 px à la
   * barre — une bascule réglée sur la fenêtre se déclencherait au mauvais
   * moment. Classes écrites en toutes lettres : Tailwind ne génère que ce qu'il
   * lit dans les sources.
   */
  const surUneRangee = actif
    ? {
        rangee: "@[61.5rem]:flex-nowrap",
        groupe: "@[61.5rem]:contents",
        export: "@[61.5rem]:order-last",
      }
    : {
        rangee: "@[55.5rem]:flex-nowrap",
        groupe: "@[55.5rem]:contents",
        export: "@[55.5rem]:order-last",
      };

  return (
    // Une seule rangée tant que la largeur le permet, et un repli à UN endroit
    // choisi : entre la recherche et les filtres. Le bloc des filtres ne sait
    // pas se comprimer, c'est donc lui qui descend en entier plutôt que de se
    // replier en escalier au milieu des listes. L'ordre de lecture est le même
    // sur une rangée ou sur deux.
    // (Voir `surUneRangee` pour le seuil et sa raison.)
    <div className="@container mb-3">
      {/* `flex-nowrap` sur une rangée : la place a été mesurée, la ligne ne doit
          plus se rompre nulle part — et surtout pas sous l'export, qui tomberait
          seul en dessous. */}
      <div className={`flex flex-wrap items-center gap-2 ${surUneRangee.rangee}`}>
        {/* Recherche et export voyagent ENSEMBLE : quand les filtres descendent,
            l'export ne les suit pas, il reste où il était — en bout de première
            ligne. Sur une rangée, `contents` dissout ce groupe et ses deux
            enfants redeviennent des éléments de la rangée, l'export renvoyé en
            fin de ligne par `order-last`. */}
        <div className={`flex w-full items-center gap-2 ${surUneRangee.groupe}`}>
          {/* 224 px, ni plus ni moins. Élastique, le champ s'élargissait au
              moment même où l'on tapait dedans — la première lettre pose `q`
              dans l'URL, « Effacer » paraît, la barre passe sur deux lignes et
              le champ se déployait alors dans la place rendue. Une ligne de
              saisie qui change de taille sous la frappe déplace ce qu'on est en
              train de lire. C'est aussi la largeur des barres d'Éditeurs et de
              Contrats, et celle sur laquelle le seuil est calculé. Il ne grandit
              jamais, et sur une rangée il ne cède rien non plus (`shrink-0`) :
              la rangée réserve aux filtres de quoi loger « Effacer », et cette
              avance suffisait sinon à grignoter le champ de quelques pixels. Il
              ne cède donc que sur un écran trop étroit pour le poser entier à
              côté de l'export, plutôt que de déborder de la page. */}
          <div className="relative w-56 @[55.5rem]:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              ref={recherche}
              type="search"
              aria-label="Rechercher un logiciel"
              placeholder="Rechercher un logiciel…"
              className="input !pl-9"
              defaultValue={params.get("q") ?? ""}
              onChange={(e) => setParam("q", e.target.value.trim())}
            />
          </div>
          {/* Poussé au bout de la ligne : c'est la liste AINSI FILTRÉE qu'il
              emporte, et il se lit après ce qui la restreint. `ml-auto` le colle
              à droite quand la recherche a atteint sa largeur maximale ; sur une
              seule rangée, les filtres ont déjà pris la place libre et il n'a
              rien à pousser. */}
          <a
            href={`/logiciels/export?${params.toString()}`}
            className={`btn-secondary ml-auto shrink-0 ${surUneRangee.export}`}
            title="Exporter la liste filtrée en CSV"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>
        {/* Les filtres tiennent ensemble. `basis` annonce la largeur qu'il leur
            faut d'un seul tenant : tant que la rangée ne l'offre pas, le bloc
            descend ENTIER sous la recherche plutôt que de s'y replier en
            escalier. `min-w-0` le laisse ensuite rétrécir une fois seul sur sa
            ligne, et c'est là seulement que ses listes se replient — sinon elles
            déborderaient de la carte sur une fenêtre étroite. */}
        <div className="flex min-w-0 basis-[39rem] grow flex-wrap items-center gap-2">
          {sel("editeur", "Éditeur", refOptions(editeurs))}
          {sel("service", "Service", refOptions(services))}
          {sel("criticite", "Criticité", refOptions(criticites))}
          {sel(
            "statut",
            "Statut",
            statuts.map((s) => ({ value: s.cle, label: s.label })),
          )}
          {sel(
            "hebergement",
            "Hébergement",
            hebergements.map((h) => ({ value: h.cle, label: h.label })),
          )}
          {/* « Effacer » reste avec les filtres : c'est sur eux qu'il porte, et
              il ne paraît que lorsqu'il y a quelque chose à effacer. */}
          {actif ? (
            <button
              type="button"
              className="btn-ghost !px-2.5"
              onClick={effacerTout}
              title="Effacer la recherche et les filtres"
            >
              <X className="h-4 w-4" />
              Effacer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
