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
    // `page=1` et non une adresse nue : la liste rendue entière se relit du
    // début, et l'URL doit le DIRE — nue, elle rouvrirait sur la page
    // mémorisée (voir `pageInitiale`). Même règle que `BarreListe`.
    router.replace(`${pathname}?page=1`);
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Retour à la première page : après un filtre, la page 4 n'existe souvent
    // plus, et l'utilisateur attend le début des résultats, pas leur milieu.
    // ÉCRITE et non retirée : retirer le dernier filtre rendrait l'adresse nue,
    // et la mémoire de page y ramènerait aussitôt la page qu'on quittait.
    next.set("page", "1");
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

  return (
    // Une seule rangée tant que la largeur le permet, et un repli à UN endroit
    // choisi : entre la recherche et les filtres. Le bloc des filtres ne sait
    // pas se comprimer, c'est donc lui qui descend en entier plutôt que de se
    // replier en escalier au milieu des listes. L'ordre de lecture est le même
    // sur une rangée ou sur deux.
    //
    // AUCUN seuil : c'est `flex-wrap` qui décide, sur la largeur RÉELLE du bloc
    // — listes et « Effacer » tels qu'affichés. Un seuil fixe a existé ici,
    // calé sur les libellés des listes ; une option choisie plus large que son
    // libellé (« AAIS Armageddon » pour « Éditeur ») le prenait en défaut de
    // quelques pixels, et « Effacer » tombait seul sous les listes. Le seuil
    // aurait dû suivre ce qui est filtré, ce qu'aucune valeur ne sait faire.
    <div className="relative mb-3">
      {/* `pr` réserve la place de l'export, posé HORS du flux à droite : c'est
          ce qui lui permet de rester en bout de première ligne quand les
          filtres descendent — dans le flux, il les suivrait sur la seconde. */}
      <div className="flex flex-wrap items-center gap-2 pr-[2.625rem]">
        {/* 224 px, ni plus ni moins. Élastique, le champ s'élargissait au
            moment même où l'on tapait dedans — la première lettre pose `q`
            dans l'URL, « Effacer » paraît, la barre passe sur deux lignes et
            le champ se déployait alors dans la place rendue. Une ligne de
            saisie qui change de taille sous la frappe déplace ce qu'on est en
            train de lire. C'est aussi la largeur des barres d'Éditeurs et de
            Contrats. */}
        <div className="relative w-56 shrink-0">
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
        {/* Les filtres tiennent ensemble. Sans `basis` posé à la main, le bloc
            demande sa largeur réelle, listes et « Effacer » sur une ligne : tant
            que la rangée ne l'offre pas, il descend ENTIER sous la recherche.
            `min-w-0` le laisse rétrécir une fois seul sur sa ligne — un item de
            `flex-wrap` ne se comprime que s'il occupe la ligne à lui seul —, et
            c'est là seulement que ses listes se replient, plutôt que de
            déborder de la carte sur une fenêtre étroite. */}
        <div className="flex min-w-0 grow flex-wrap items-center gap-2">
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
      {/* À droite de la PREMIÈRE ligne, quoi qu'il arrive : c'est la liste
          AINSI FILTRÉE qu'il emporte, et il se lit après ce qui la restreint.
          À la hauteur des champs — sans texte, le bouton ne mesurait que
          son icône et flottait 2 px plus bas que la recherche.

          L'icône SEULE : la rangée est déjà serrée, et la flèche vers le bas
          se lit sans mot. Ce qu'elle emporte — la liste filtrée, en CSV — se
          dit au survol, et au lecteur d'écran par `aria-label`. */}
      <a
        href={`/logiciels/export?${params.toString()}`}
        className="btn-secondary absolute right-0 top-0 h-[1.875rem] !px-2"
        title="Exporter la liste filtrée en CSV"
        aria-label="Exporter la liste filtrée en CSV"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
