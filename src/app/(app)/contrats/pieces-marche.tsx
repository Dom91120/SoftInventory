"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { type CategorieOption, LigneDocument } from "@/components/documents-panel";
import { FormulairePiece, type PieceContratRow, usePieceContrat } from "@/components/piece-contrat";
import { Card, EmptyState } from "@/components/ui";
import { DATE_FMT_FR_UTC } from "@/lib/format";

/** "AAAA-MM-JJ" → "JJ/MM/AAAA", ancrée en UTC comme la colonne `@db.Date`. */
function enDateFr(iso: string): string {
  return DATE_FMT_FR_UTC.format(new Date(`${iso}T00:00:00.000Z`));
}

/**
 * Les pièces du marché, sur SA fiche : la même saisie que dans l'onglet
 * Contrats/Marchés d'un logiciel — formulaire et enregistrement viennent du
 * module partagé — mais présentée en carte de plein droit plutôt qu'imbriquée
 * dans la ligne d'un marché.
 *
 * C'est ce qui rend un marché sans logiciel rattaché utilisable : ses pièces se
 * déposent ici, sans passer par une fiche logiciel.
 */
export function PiecesMarche({
  contratId,
  pieces,
  categories,
  categorieParDefautId,
  readOnly,
}: {
  contratId: number;
  pieces: PieceContratRow[];
  categories: CategorieOption[];
  /** « Contrat » du référentiel ; null s'il a été renommé ou supprimé. */
  categorieParDefautId: number | null;
  readOnly: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  // Formulaire ouvert : sur une pièce existante (crayon) ou sur une neuve.
  const [ouvert, setOuvert] = useState<{ row: PieceContratRow | null } | null>(null);
  const piece = usePieceContrat(setError);

  return (
    <Card
      title={pieces.length > 1 ? "Pièces du marché" : "Pièce du marché"}
      actions={
        readOnly ? undefined : (
          <button
            type="button"
            className="btn-secondary !py-1.5"
            disabled={piece.pending}
            onClick={() => setOuvert((o) => (o?.row === null ? null : { row: null }))}
          >
            {ouvert?.row === null ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {ouvert?.row === null ? "Fermer" : "Ajouter une pièce"}
          </button>
        )
      }
    >
      {error ? <p className="alert-error mb-3">{error}</p> : null}

      {/* L'ajout se pose AU-DESSUS de la liste ; la modification prend la place
          de la pièce concernée, plus bas. */}
      {ouvert?.row === null ? (
        <FormulairePiece
          key="p-new"
          row={null}
          categories={categories}
          categorieParDefautId={categorieParDefautId}
          pending={piece.pending}
          onSubmit={(e, fichier) =>
            piece.soumettre(e, fichier, { contratId, row: null }, () => setOuvert(null))
          }
          onCancel={() => setOuvert(null)}
        />
      ) : null}

      {pieces.length === 0 ? (
        <EmptyState>
          Aucune pièce — le marché signé, sa notification, la décision qui l'autorise…
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {pieces.map((p) =>
            ouvert?.row?.id === p.id ? (
              <li key={p.id} className="py-2">
                <FormulairePiece
                  key={`p-${p.id}`}
                  row={p}
                  categories={categories}
                  categorieParDefautId={categorieParDefautId}
                  pending={piece.pending}
                  onSubmit={(e, fichier) =>
                    piece.soumettre(e, fichier, { contratId, row: p }, () => setOuvert(null))
                  }
                  onCancel={() => setOuvert(null)}
                  className="rounded-xl border border-sub bg-inset p-4"
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                {p.document ? (
                  <LigneDocument
                    document={p.document}
                    categories={categories}
                    readOnly={readOnly}
                    // Le crayon de la pièce porte la catégorie et la date :
                    // elles se lisent ici, elles s'y modifient.
                    categorieModifiable={false}
                    dateLigne={p.datePiece ? enDateFr(p.datePiece) : ""}
                    onErreur={setError}
                  />
                ) : (
                  // Sans fichier, LigneDocument ne s'affiche pas — et la date de
                  // la pièce, qui vit à l'intérieur, disparaîtrait avec elle.
                  <span className="text-faint">{p.datePiece ? enDateFr(p.datePiece) : "—"}</span>
                )}
                {readOnly ? null : (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost !p-2"
                      title="Modifier la pièce"
                      disabled={piece.pending}
                      onClick={() => setOuvert({ row: p })}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !p-2 hover:!text-danger"
                      title={
                        p.document ? "Supprimer la pièce et son fichier" : "Supprimer la pièce"
                      }
                      disabled={piece.pending}
                      onClick={() => piece.supprimer(p, enDateFr)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </Card>
  );
}
