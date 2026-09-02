"use client";

import { Download, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Barre d'une liste : recherche, filtres facultatifs et export CSV — pilotée par
 * l'URL (searchParams). Les filtres sont ainsi rechargeables et partageables, et
 * l'export reprend la même query string : ce qu'on voit est ce qu'on exporte.
 *
 * L'inventaire des logiciels garde sa propre barre : elle porte six filtres et
 * des libellés qui lui sont propres. Celle-ci sert les listes plus simples
 * (éditeurs, marchés), qui n'avaient rien.
 */
export function BarreListe({
  rechercheLabel,
  exportHref,
  selects = [],
  actions,
}: {
  /**
   * Ce qui vient APRÈS l'export, au bout de la ligne : le sélecteur de vue de
   * l'écran Serveurs. Rendu côté serveur par la page, glissé ici pour partager
   * la rangée plutôt que d'en prendre une à lui.
   */
  actions?: ReactNode;
  /** Libellé accessible du champ de recherche, ex. « Rechercher un éditeur ». */
  rechercheLabel: string;
  /** Racine de la route d'export ; la query string courante lui est ajoutée. */
  exportHref: string;
  /** Filtres à choix unique, dans l'ordre d'affichage. */
  selects?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Retour à la première page : après un filtre, la page 4 n'existe souvent
    // plus, et l'utilisateur attend le début des résultats, pas leur milieu.
    // ÉCRITE et non retirée : une URL nue rouvrirait la liste sur la page
    // mémorisée (voir `pageInitiale`), et le filtre s'appliquerait en plein
    // milieu des résultats.
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`);
  }

  /**
   * Ce qui n'est PAS un filtre : la pagination et l'ordre d'affichage. Ils
   * vivent dans la même query string mais ne restreignent rien — « Effacer »
   * s'allumerait sur une simple page 2 ou une colonne triée, et proposerait
   * d'effacer ce que l'on n'a pas posé.
   */
  const HORS_FILTRES = new Set(["page", "tri", "sens", "vue"]);
  const actif = [...params.keys()].some((k) => !HORS_FILTRES.has(k));

  /** Efface les filtres SEULS : l'ordre et la vue choisis n'en sont pas et lui survivent. */
  function effacerFiltres() {
    const next = new URLSearchParams();
    for (const k of ["tri", "sens", "vue"]) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    // Même raison que ci-dessus : la liste rendue entière se relit du début, et
    // l'URL doit le DIRE pour que la mémoire de page ne s'en mêle pas.
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    // Deux zones côte à côte, sans repli entre elles : à gauche ce qui filtre,
    // à droite ce qui agit sur la liste (export, puis actions). La zone de
    // gauche prend le reste et se replie SEULE : les filtres, « Effacer »
    // compris, descendent entiers sous la recherche dès qu'ils ne tiennent pas
    // à côté — c'est `flex-wrap` qui le décide, sur leur largeur réelle, et
    // aucun seuil ne le sait mieux que lui. L'export reste ainsi en haut à
    // droite sur une rangée comme sur deux, sans qu'on ait à connaître sa
    // largeur ni celle des actions. Même dessin que la barre des logiciels.
    <div className="mb-3 flex items-start gap-2">
      <div className="flex min-w-0 grow flex-wrap items-center gap-2">
        {/* 224 px, ni plus ni moins, et il ne cède rien : un champ de saisie qui
            change de taille déplace ce qu'on est en train de lire. */}
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            aria-label={rechercheLabel}
            placeholder="Rechercher…"
            className="input !w-56 !pl-9"
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => setParam("q", e.target.value.trim())}
          />
        </div>
        {/* Les filtres tiennent ensemble. `min-w-0` laisse le bloc rétrécir une
            fois seul sur sa ligne — un item de `flex-wrap` ne se comprime que
            s'il occupe la ligne à lui seul —, et c'est là seulement que ses
            listes se replient, plutôt que de déborder sur une fenêtre étroite. */}
        <div className="flex min-w-0 grow flex-wrap items-center gap-2">
          {selects.map((s) => (
            <select
              key={s.key}
              aria-label={s.label}
              className="input !w-auto max-w-full sm:max-w-xs"
              value={params.get(s.key) ?? ""}
              onChange={(e) => setParam(s.key, e.target.value)}
            >
              <option value="">{s.label}</option>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          {actif ? (
            <button
              type="button"
              className="btn-ghost !px-2.5"
              onClick={effacerFiltres}
              title="Effacer les filtres"
            >
              <X className="h-4 w-4" />
              Effacer
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* L'icône SEULE : la rangée est déjà serrée, et la flèche vers le bas
            se lit sans mot. Ce qu'elle emporte — la liste filtrée, en CSV — se
            dit au survol, et au lecteur d'écran par `aria-label`. À la hauteur
            des champs : sans texte, le bouton ne mesurait que son icône et
            flottait 2 px plus bas que la recherche. */}
        <a
          href={`${exportHref}?${params.toString()}`}
          className="btn-secondary h-[1.875rem] !px-2"
          title="Exporter la liste filtrée en CSV"
          aria-label="Exporter la liste filtrée en CSV"
        >
          <Download className="h-4 w-4" />
        </a>
        {actions}
      </div>
    </div>
  );
}
