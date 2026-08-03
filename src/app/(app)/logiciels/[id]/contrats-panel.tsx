"use client";

import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import {
  type CategorieOption,
  type DocumentRow,
  LigneDocument,
} from "@/components/documents-panel";
import { Card, EmptyState, Field } from "@/components/ui";
import { formatEuros } from "@/lib/format";
import { LIBELLES } from "@/schemas/logiciel";
import {
  createContratAction,
  createPieceContratAction,
  deleteContratAction,
  deletePieceContratAction,
  updateContratAction,
  updatePieceContratAction,
} from "../actions";

export type PieceContratRow = {
  id: number;
  type: string;
  coutAnnuel: string; // Decimal sérialisé ("" si null)
  dateRenouvellement: string; // AAAA-MM-JJ ou ""
  /** Le fichier qui atteste la pièce. Un seul — d'où le null et non un tableau. */
  document: DocumentRow | null;
};

export type ContratRow = {
  id: number;
  libelle: string;
  /** Société avec qui on contractualise ; "" = l'éditeur du logiciel. */
  fournisseurId: string;
  fournisseurNom: string | null;
  referenceMarche: string;
  notes: string;
  pieces: PieceContratRow[];
};

/**
 * Type posé d'office sur les pièces déposées depuis cet onglet. « Marché »
 * existe aussi dans le référentiel : c'est un choix à faire au cas par cas,
 * depuis la liste sous le nom du fichier.
 */
const TYPE_PAR_DEFAUT = "Contrat";

/**
 * Onglet Contrats : les contrats et marchés du logiciel et, sous chacun, ses
 * pièces. Même organisation que l'onglet Devis, pour la même raison : le marché
 * dit AVEC QUI on s'engage et sous quelle référence, la pièce dit COMBIEN et
 * JUSQU'À QUAND. Un marché couvre souvent plusieurs postes aux termes distincts.
 *
 * Saisie en UNE étape : le formulaire d'une pièce porte son fichier, et l'écran
 * enchaîne création puis dépôt. Les corbeilles emportent tout ce qui pend en
 * dessous, fichiers compris.
 *
 * Le plafond d'utilisateurs se saisit dans l'onglet Synthèse (il appartient au
 * logiciel) ; on le reçoit ici pour garder l'alerte de dépassement devant les
 * contrats, seul endroit où l'on peut la régulariser.
 */
export function ContratsPanel({
  logicielId,
  contrats,
  categories,
  editeurs,
  editeurDuLogiciel,
  nbUtilisateurs,
  nbMaxUtilisateurs,
  readOnly,
}: {
  logicielId: number;
  contrats: ContratRow[];
  /** Référentiel des types de document, pour la liste sous le nom du fichier. */
  categories: CategorieOption[];
  /** Annuaire des sociétés, pour désigner un revendeur. */
  editeurs: Array<{ id: number; nom: string }>;
  /** Éditeur du logiciel : fournisseur par défaut quand le marché n'en nomme pas. */
  editeurDuLogiciel: string | null;
  nbUtilisateurs: number | null;
  nbMaxUtilisateurs: number | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categorieContratId = categories.find((c) => c.label === TYPE_PAR_DEFAUT)?.id ?? null;

  // Formulaire de marché : ouvert en création ou en édition.
  const [marcheForm, setMarcheForm] = useState<
    { mode: "creation" } | { mode: "edition"; row: ContratRow } | null
  >(null);
  // Formulaire de pièce : rattaché à un marché, en création ou édition.
  const [pieceForm, setPieceForm] = useState<{
    contratId: number;
    row: PieceContratRow | null;
  } | null>(null);

  const nomDe = (c: ContratRow) => c.libelle || c.referenceMarche || "sans libellé";

  function soumettreMarche(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!marcheForm) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const cible = marcheForm;
    startTransition(async () => {
      const res =
        cible.mode === "edition"
          ? await updateContratAction(cible.row.id, form)
          : await createContratAction(logicielId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMarcheForm(null);
      router.refresh();
    });
  }

  /**
   * Enregistre la pièce PUIS son fichier, en un seul geste pour qui saisit.
   *
   * L'ordre est imposé : le dépôt se rattache à une pièce, qui doit donc
   * exister — d'où l'id renvoyé par createPieceContratAction. En modification,
   * un nouveau fichier REMPLACE l'ancien : on retire d'abord
   * (deleteDocumentAction efface aussi le fichier du disque), on dépose ensuite.
   */
  function soumettrePiece(e: React.FormEvent<HTMLFormElement>, fichier: File | null) {
    e.preventDefault();
    if (!pieceForm) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const cible = pieceForm;
    startTransition(async () => {
      const res = cible.row
        ? await updatePieceContratAction(cible.row.id, form)
        : await createPieceContratAction(cible.contratId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const pieceId = cible.row?.id ?? res.id;
      if (fichier && pieceId !== undefined) {
        if (cible.row?.document) {
          const retrait = await deleteDocumentAction(cible.row.document.id);
          if (!retrait.ok) {
            // La pièce est enregistrée, le fichier non : on le dit plutôt que de
            // refermer le formulaire sur un demi-résultat.
            setError(
              `Pièce enregistrée, mais le fichier n'a pas pu être remplacé : ${retrait.error}`,
            );
            router.refresh();
            return;
          }
        }
        const echec = await deposerPiece(pieceId, fichier, categorieContratId);
        if (echec) {
          setError(`Pièce enregistrée, mais le dépôt a échoué : ${echec}`);
          router.refresh();
          return;
        }
      }
      setPieceForm(null);
      router.refresh();
    });
  }

  function supprimerMarche(c: ContratRow) {
    const nbFichiers = c.pieces.filter((l) => l.document).length;
    const details = [
      c.pieces.length > 0 ? `${c.pieces.length} pièce(s)` : null,
      nbFichiers > 0 ? `${nbFichiers} fichier(s) joint(s)` : null,
    ].filter(Boolean);
    const avert = details.length > 0 ? `\n\nSes ${details.join(" et ses ")} aussi.` : "";
    if (!window.confirm(`Supprimer le contrat « ${nomDe(c)} » ?${avert}`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContratAction(c.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function supprimerPiece(l: PieceContratRow) {
    const avert = l.document ? `\n\nSon fichier « ${l.document.nomOriginal} » aussi.` : "";
    const nom = LIBELLES.typeContrat[l.type as keyof typeof LIBELLES.typeContrat];
    if (!window.confirm(`Supprimer la pièce « ${nom} » ?${avert}`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePieceContratAction(l.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  // Utilisateurs non comptés : rien à comparer, donc pas d'alerte.
  const depassement =
    nbUtilisateurs !== null && nbMaxUtilisateurs !== null && nbUtilisateurs > nbMaxUtilisateurs;

  return (
    <div className="space-y-6">
      {error ? <p className="alert-error">{error}</p> : null}

      {depassement ? (
        <div className="alert-danger">
          <strong className="text-danger-text">Plafond dépassé :</strong>{" "}
          <span className="text-muted">
            {nbUtilisateurs} utilisateurs réels pour {nbMaxUtilisateurs} prévus au contrat.
            Régularisez à la prochaine échéance.
          </span>
        </div>
      ) : null}

      <Card
        title="Contrats et marchés"
        actions={
          readOnly ? undefined : (
            <button
              type="button"
              className="btn-secondary !py-1.5"
              onClick={() =>
                setMarcheForm((f) => (f?.mode === "creation" ? null : { mode: "creation" }))
              }
            >
              {marcheForm?.mode === "creation" ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {marcheForm?.mode === "creation" ? "Fermer" : "Ajouter un contrat ou marché"}
            </button>
          )
        }
      >
        {marcheForm ? (
          <FormulaireMarche
            key={marcheForm.mode === "edition" ? `m-${marcheForm.row.id}` : "m-new"}
            row={marcheForm.mode === "edition" ? marcheForm.row : null}
            editeurs={editeurs}
            editeurDuLogiciel={editeurDuLogiciel}
            pending={pending}
            onSubmit={soumettreMarche}
            onCancel={() => setMarcheForm(null)}
          />
        ) : null}

        {contrats.length === 0 ? (
          <EmptyState>
            Aucun contrat enregistré. Un contrat ou marché regroupe les pièces engagées auprès d'une
            même société.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {contrats.map((c) => (
              // `bg-page` : le fond des pages de l'application, plus sourd que
              // la carte blanche qui les contient. Chaque marché se détache
              // ainsi comme un bloc, sans ajouter de bordure ni d'ombre.
              <section key={c.id} className="rounded-xl border border-line bg-page">
                {/* `gap-4` et non `gap-2` : la colonne du fournisseur touchait
                    presque le bouton « + Pièce », faute d'air entre le bloc de
                    titre et celui des actions. */}
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
                  <span className="min-w-0 flex-1">
                    {/* Trois colonnes de largeur fixe plutôt qu'un flux : d'un
                        marché à l'autre, référence, libellé et fournisseur
                        tombent ainsi au même endroit. Chacune tronque son
                        contenu — le libellé, seul à s'étirer, absorbe la place
                        restante et se coupe en « … » quand il déborde. */}
                    <span className="grid grid-cols-[minmax(3rem,5rem)_minmax(8rem,1fr)_minmax(6rem,14rem)] items-baseline gap-2 font-semibold text-strong">
                      <span className="truncate" title={c.referenceMarche || undefined}>
                        {c.referenceMarche}
                      </span>
                      <span className="truncate" title={c.libelle || undefined}>
                        {c.libelle || (c.referenceMarche ? "" : "sans libellé")}
                      </span>
                      {/* Le fournisseur rejoint l'en-tête du marché : c'est lui
                          qu'on engage, au même titre que la référence.
                          Sans société nommée, c'est l'éditeur du logiciel qui
                          s'applique — on l'affiche plutôt qu'un vide. */}
                      <span
                        className="truncate text-muted"
                        title={c.fournisseurNom ?? editeurDuLogiciel ?? undefined}
                      >
                        {c.fournisseurNom ?? editeurDuLogiciel}
                      </span>
                    </span>
                    <span className="text-xs text-faint">
                      {`${c.pieces.length} pièce${c.pieces.length > 1 ? "s" : ""}`}
                    </span>
                  </span>
                  {readOnly ? null : (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="btn-secondary !py-1.5"
                        disabled={pending}
                        onClick={() =>
                          setPieceForm((f) =>
                            f?.contratId === c.id && f.row === null
                              ? null
                              : { contratId: c.id, row: null },
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Pièce
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !p-2"
                        title="Modifier le contrat"
                        disabled={pending}
                        onClick={() => setMarcheForm({ mode: "edition", row: c })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {/* Jamais grisée : elle emporte le contrat, ses pièces et
                          leurs fichiers — voir deleteContrat. */}
                      <button
                        type="button"
                        className="btn-ghost !p-2 hover:!text-danger"
                        title="Supprimer le contrat, ses pièces et leurs fichiers"
                        disabled={pending}
                        onClick={() => supprimerMarche(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </header>

                <div className="p-4">
                  {/* Ajout : le formulaire se pose au-dessus du tableau, il n'y
                      a pas encore de pièce. En MODIFICATION il prend la place de
                      la pièce concernée, plus bas. */}
                  {pieceForm?.contratId === c.id && pieceForm.row === null ? (
                    <FormulairePiece
                      key={`p-new-${c.id}`}
                      row={null}
                      pending={pending}
                      onSubmit={soumettrePiece}
                      onCancel={() => setPieceForm(null)}
                    />
                  ) : null}

                  {c.pieces.length === 0 ? (
                    <p className="text-sm text-faint">Aucune pièce pour ce contrat.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {/* La LIGNE est la pièce ; cette colonne montre le
                                fichier qui l'atteste, d'où le nom distinct. */}
                            <th>Fichier</th>
                            <th>Type</th>
                            <th className="text-right">Coût annuel</th>
                            <th>Renouvellement</th>
                            {readOnly ? null : <th className="w-20" aria-label="Actions" />}
                          </tr>
                        </thead>
                        <tbody>
                          {c.pieces.map((l) =>
                            pieceForm?.row?.id === l.id ? (
                              <tr key={l.id}>
                                <td colSpan={readOnly ? 4 : 5} className="!py-2 !pr-0">
                                  <FormulairePiece
                                    key={`p-${l.id}`}
                                    row={l}
                                    pending={pending}
                                    onSubmit={soumettrePiece}
                                    onCancel={() => setPieceForm(null)}
                                    className="rounded-xl border border-sub bg-inset p-4"
                                  />
                                </td>
                              </tr>
                            ) : (
                              <tr key={l.id}>
                                <td>
                                  {l.document ? (
                                    <LigneDocument
                                      document={l.document}
                                      categories={categories}
                                      readOnly={readOnly}
                                      onErreur={setError}
                                    />
                                  ) : (
                                    <span className="text-faint">—</span>
                                  )}
                                </td>
                                <td>
                                  {
                                    LIBELLES.typeContrat[
                                      l.type as keyof typeof LIBELLES.typeContrat
                                    ]
                                  }
                                </td>
                                <td className="text-right tabular-nums">
                                  {formatEuros(l.coutAnnuel) ?? "—"}
                                </td>
                                <td>{l.dateRenouvellement || "—"}</td>
                                {readOnly ? null : (
                                  <td>
                                    <span className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        className="btn-ghost !p-2"
                                        title="Modifier la pièce"
                                        disabled={pending}
                                        onClick={() => setPieceForm({ contratId: c.id, row: l })}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-ghost !p-2 hover:!text-danger"
                                        title={
                                          l.document
                                            ? "Supprimer la pièce et son fichier"
                                            : "Supprimer la pièce"
                                        }
                                        disabled={pending}
                                        onClick={() => supprimerPiece(l)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </span>
                                  </td>
                                )}
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Dépose le fichier d'une pièce. Renvoie null si tout s'est bien passé, sinon le
 * message d'erreur — l'appelant décide quoi en dire.
 *
 * Route API et non server action : c'est un flux binaire.
 */
async function deposerPiece(
  pieceContratId: number,
  fichier: File,
  categorieId: number | null,
): Promise<string | null> {
  try {
    const form = new FormData();
    form.set("file", fichier);
    form.set("pieceContratId", String(pieceContratId));
    if (categorieId !== null) form.set("categorieId", String(categorieId));
    const r = await fetch("/api/documents/upload", { method: "POST", body: form });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return j.error ?? "le dépôt a échoué, réessayez.";
    return null;
  } catch {
    return "le dépôt a échoué (réseau), réessayez.";
  }
}

/** Le marché : ce qui l'identifie. Ni montant ni échéance, ils sont sur ses pièces. */
function FormulaireMarche({
  row,
  editeurs,
  editeurDuLogiciel,
  pending,
  onSubmit,
  onCancel,
}: {
  row: ContratRow | null;
  editeurs: Array<{ id: number; nom: string }>;
  editeurDuLogiciel: string | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mb-5 rounded-xl border border-sub bg-inset p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Référence marché/contrat" htmlFor="referenceMarche">
          <input
            id="referenceMarche"
            name="referenceMarche"
            defaultValue={row?.referenceMarche ?? ""}
            disabled={pending}
            className="input"
          />
        </Field>
        <Field
          label="Fournisseur"
          htmlFor="fournisseurId"
          hint="La société avec qui on contractualise. Vide = l'éditeur du logiciel ; à renseigner quand c'est un revendeur."
        >
          <select
            id="fournisseurId"
            name="fournisseurId"
            defaultValue={row?.fournisseurId ?? ""}
            disabled={pending}
            className="input"
          >
            <option value="">
              {editeurDuLogiciel
                ? `— l'éditeur du logiciel (${editeurDuLogiciel}) —`
                : "— non précisé —"}
            </option>
            {editeurs.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.nom}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Libellé" htmlFor="libelle">
          <input
            id="libelle"
            name="libelle"
            placeholder="Ex. marché 2024-12, pack 50 postes"
            defaultValue={row?.libelle ?? ""}
            disabled={pending}
            className="input"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={row?.notes ?? ""}
              disabled={pending}
              className="input"
            />
          </Field>
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Enregistrement…" : row ? "Enregistrer" : "Ajouter le contrat"}
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * La pièce : son fichier, son type, son coût, son échéance. Le fichier est retenu
 * en mémoire jusqu'à la validation — avant elle, il n'existe aucune pièce à
 * laquelle le rattacher.
 */
function FormulairePiece({
  row,
  pending,
  onSubmit,
  onCancel,
  className = "mb-4 rounded-xl border border-sub bg-inset p-4",
}: {
  row: PieceContratRow | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, fichier: File | null) => void;
  onCancel: () => void;
  /** Habillage : la marge basse saute quand le formulaire tient dans une ligne de tableau. */
  className?: string;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={(e) => onSubmit(e, fichier)} className={className}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-full sm:w-44">
          <Field
            label="Fichier"
            hint={
              row?.document && !fichier
                ? `Actuel : ${row.document.nomOriginal}. En choisir un autre le remplace.`
                : "PDF, Office, images, zip — 25 Mo max."
            }
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Déposer un fichier
            </button>
            {fichier ? (
              <p className="mt-1 flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate text-xs text-strong" title={fichier.name}>
                  {fichier.name}
                </span>
                <button
                  type="button"
                  className="btn-ghost !p-1 shrink-0"
                  title={`Retirer ${fichier.name} de la sélection`}
                  disabled={pending}
                  onClick={() => {
                    setFichier(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            ) : null}
          </Field>
        </div>
        <div className="shrink-0">
          <Field label="Type" htmlFor="type">
            <select
              id="type"
              name="type"
              defaultValue={row?.type ?? "abonnement"}
              disabled={pending}
              className="input !w-auto"
            >
              {Object.entries(LIBELLES.typeContrat).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="shrink-0">
          <Field label="Coût annuel (€)" htmlFor="coutAnnuel">
            <input
              id="coutAnnuel"
              name="coutAnnuel"
              inputMode="decimal"
              defaultValue={row?.coutAnnuel ?? ""}
              disabled={pending}
              className="input !w-[19ch]"
            />
          </Field>
        </div>
        <div className="shrink-0">
          <Field
            label="Renouvellement"
            htmlFor="dateRenouvellement"
            hint="Déclenche un rappel avant l'échéance."
          >
            <input
              id="dateRenouvellement"
              name="dateRenouvellement"
              type="date"
              defaultValue={row?.dateRenouvellement ?? ""}
              disabled={pending}
              className="input !w-auto"
            />
          </Field>
        </div>
        {/* Les boutons rejoignent la rangée des champs. Le libellé invisible
            leur donne le même décalage que les autres colonnes : sans lui, ils
            se caleraient sur le haut du bloc, au niveau des étiquettes. */}
        <div className="shrink-0">
          <span className="label invisible" aria-hidden="true">
            Actions
          </span>
          <span className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="btn-secondary" disabled={pending} onClick={onCancel}>
              Annuler
            </button>
          </span>
        </div>
      </div>
    </form>
  );
}
