"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createRefAction, deleteRefAction, type RefEntity, updateRefAction } from "./actions";

export type RefColumn = {
  key: string;
  label: string;
  type?: "text" | "number" | "color";
  placeholder?: string;
  width?: string;
};

type Row = { id: number } & Record<string, unknown>;

/**
 * Éditeur générique de référentiel : une ligne de saisie pour AJOUTER, puis les
 * lignes existantes éditables en place (le bouton ✓ n'apparaît que si la ligne
 * a été modifiée). Chaque opération est immédiate (server action) — pas de
 * brouillon global : les référentiels sont de petites tables, la simplicité
 * prime sur l'édition en lot.
 */
export function RefTable({
  entity,
  columns,
  rows,
  emptyLabel,
  fige = false,
}: {
  entity: RefEntity;
  columns: RefColumn[];
  rows: Row[];
  emptyLabel: string;
  /** Liste figée : lignes éditables, mais ni ajout ni suppression. */
  fige?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Valeurs éditées par ligne (id → colonne → valeur) ; absent = valeur d'origine.
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});

  const asStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  function valeur(row: Row, col: RefColumn): string {
    return edits[row.id]?.[col.key] ?? asStr(row[col.key]);
  }

  function dirty(row: Row): boolean {
    const e = edits[row.id];
    if (!e) return false;
    return columns.some((c) => c.key in e && e[c.key] !== asStr(row[c.key]));
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else onOk?.();
    });
  }

  function ajouter() {
    const input = Object.fromEntries(columns.map((c) => [c.key, draft[c.key] ?? ""]));
    run(
      () => createRefAction(entity, input),
      () => setDraft({}),
    );
  }

  function enregistrer(row: Row) {
    const input = Object.fromEntries(columns.map((c) => [c.key, valeur(row, c)]));
    run(
      () => updateRefAction(entity, row.id, input),
      () => setEdits((prev) => ({ ...prev, [row.id]: {} })),
    );
  }

  function supprimer(row: Row) {
    const libelle = asStr(row[columns[0]?.key ?? "label"]);
    if (!window.confirm(`Supprimer « ${libelle} » de ce référentiel ?`)) return;
    run(() => deleteRefAction(entity, row.id));
  }

  const inputClass = (col: RefColumn) =>
    col.type === "color" ? "input h-9 w-16 cursor-pointer p-1" : "input";

  return (
    <div className="space-y-3">
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
              <th className="w-20" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {/* Ligne d'ajout — absente des listes figées */}
            <tr hidden={fige}>
              {columns.map((c) => (
                <td key={c.key}>
                  <input
                    type={c.type ?? "text"}
                    className={inputClass(c)}
                    placeholder={c.placeholder ?? c.label}
                    value={draft[c.key] ?? (c.type === "color" ? "#94a3b8" : "")}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                    disabled={pending}
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  className="btn-primary !px-3 !py-1.5"
                  onClick={ajouter}
                  disabled={pending}
                  title="Ajouter"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </td>
            </tr>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    <input
                      type={c.type ?? "text"}
                      className={inputClass(c)}
                      value={valeur(row, c)}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.id]: { ...prev[row.id], [c.key]: e.target.value },
                        }))
                      }
                      disabled={pending}
                    />
                  </td>
                ))}
                <td>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost !p-2"
                      onClick={() => enregistrer(row)}
                      disabled={pending || !dirty(row)}
                      title="Enregistrer la ligne"
                      style={dirty(row) ? { color: "var(--color-ok)" } : undefined}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    {fige ? null : (
                      <button
                        type="button"
                        className="btn-ghost !p-2 hover:!text-danger"
                        onClick={() => supprimer(row)}
                        disabled={pending}
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="py-2 text-center text-sm text-faint">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
