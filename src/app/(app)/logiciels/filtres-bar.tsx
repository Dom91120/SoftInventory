"use client";

import { Download, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
}: {
  editeurs: Option[];
  services: Option[];
  criticites: Option[];
  technologies: Option[];
  /** Statuts du référentiel : libellés administrables, clés figées. */
  statuts: Array<{ cle: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const actif = [...params.keys()].length > 0;

  const sel = (key: string, label: string, options: Array<{ value: string; label: string }>) => (
    <select
      aria-label={label}
      className="input !w-auto"
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
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          aria-label="Rechercher un logiciel"
          placeholder="Rechercher…"
          className="input !w-56 !pl-9"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value.trim())}
        />
      </div>
      {sel("editeur", "Éditeur", refOptions(editeurs))}
      {sel("service", "Service", refOptions(services))}
      {sel("criticite", "Criticité", refOptions(criticites))}
      {sel("technologie", "Technologie", refOptions(technologies))}
      {sel("hebergement", "Hébergement", [
        { value: "saas", label: "SaaS" },
        { value: "on_premise", label: "On premise" },
        { value: "hybride", label: "Hybride" },
      ])}
      {sel(
        "statut",
        "Statut",
        statuts.map((s) => ({ value: s.cle, label: s.label })),
      )}
      {actif ? (
        <button
          type="button"
          className="btn-ghost !px-2.5"
          onClick={() => router.replace(pathname)}
          title="Effacer les filtres"
        >
          <X className="h-4 w-4" />
          Effacer
        </button>
      ) : null}
      <a
        href={`/logiciels/export?${params.toString()}`}
        className="btn-secondary ml-auto"
        title="Exporter la liste filtrée en CSV"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </a>
    </div>
  );
}
