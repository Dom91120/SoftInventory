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
  technologies,
  statuts,
  hebergements,
}: {
  editeurs: Option[];
  services: Option[];
  criticites: Option[];
  technologies: Option[];
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

  const actif = [...params.keys()].length > 0;

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

  return (
    // Une seule rangée tant que la largeur le permet, et un repli à UN endroit
    // choisi : entre la recherche et les filtres. Le champ est élastique, le
    // bloc des filtres ne l'est pas — il ne sait pas se comprimer, donc c'est
    // lui qui descend en entier plutôt que de se replier en escalier au milieu
    // des listes. L'ordre de lecture est le même sur une rangée ou sur deux.
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* Le champ prend la place laissée libre plutôt qu'une largeur fixe,
          jusqu'à 448 px : au-delà, une ligne de saisie devient une bannière et
          le curseur se perd dans le vide à sa droite. Son plancher de 224 px
          est ce qui décide du repli : en dessous, il ne resterait pas de quoi
          chercher. */}
      <div className="relative min-w-56 max-w-md flex-1">
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
      {/* Les filtres tiennent ensemble. `basis` annonce la largeur qu'il leur
          faut d'un seul tenant : tant que la rangée ne l'offre pas, le bloc
          descend ENTIER sous la recherche plutôt que de s'y replier en escalier.
          `min-w-0` le laisse ensuite rétrécir une fois seul sur sa ligne, et
          c'est là seulement que ses listes se replient — sinon elles
          déborderaient de la carte sur une fenêtre étroite. */}
      <div className="flex min-w-0 basis-[46rem] grow flex-wrap items-center gap-2">
        {sel("editeur", "Éditeur", refOptions(editeurs))}
        {sel("service", "Service", refOptions(services))}
        {sel("criticite", "Criticité", refOptions(criticites))}
        {sel("technologie", "Technologie", refOptions(technologies))}
        {sel(
          "hebergement",
          "Hébergement",
          hebergements.map((h) => ({ value: h.cle, label: h.label })),
        )}
        {sel(
          "statut",
          "Statut",
          statuts.map((s) => ({ value: s.cle, label: s.label })),
        )}
        {/* « Effacer » reste avec les filtres : c'est sur eux qu'il porte, et il
            ne paraît que lorsqu'il y a quelque chose à effacer. */}
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
        {/* Réduit à sa flèche et poussé au bout de la rangée des filtres : c'est
            la liste AINSI FILTRÉE qu'il emporte, et l'icône de téléchargement se
            passe de légende. Le libellé entier reste au survol et pour les
            lecteurs d'écran. Dans le bloc et non à côté : il suit les filtres
            quand ils descendent, au lieu de rester seul sur une ligne. */}
        <a
          href={`/logiciels/export?${params.toString()}`}
          className="btn-secondary ml-auto !px-2"
          title="Exporter la liste filtrée en CSV"
          aria-label="Exporter la liste filtrée en CSV"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
