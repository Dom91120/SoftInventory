"use client";

import { Pencil, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { createEditeurAction } from "@/app/(app)/editeurs/actions";
import { DETAIL_FICHIER_DEFINITIF, useConfirmation } from "@/components/confirmation";
import {
  type CategorieOption,
  type DocumentRow,
  LigneDocument,
} from "@/components/documents-panel";
import { Card, EmptyState, Field } from "@/components/ui";
import { formatEuros } from "@/lib/format";
import {
  createConsultationAction,
  createDevisAction,
  deleteConsultationAction,
  deleteDevisAction,
  marquerDevisRetenuAction,
  updateConsultationAction,
  updateDevisAction,
} from "../actions";

export type DevisRow = {
  id: number;
  /** "" = société non renseignée (devis reçu d'une entreprise hors annuaire). */
  fournisseurId: string;
  fournisseurNom: string | null;
  montant: string; // Decimal sérialisé ("" si null)
  date: string; // AAAA-MM-JJ ou ""
  retenu: boolean;
  /** Le devis lui-même. Un seul fichier par ligne — d'où le null et non un tableau. */
  document: DocumentRow | null;
};

export type ConsultationRow = {
  id: number;
  objet: string;
  date: string; // AAAA-MM-JJ ou ""
  devis: DevisRow[];
};

/**
 * Onglet Devis : les mises en concurrence du logiciel et, sous chacune, les
 * devis reçus. Le devis retenu porte une marque — AU PLUS UN par consultation,
 * l'action serveur démarquant les autres.
 *
 * Le regroupement par consultation n'est pas décoratif : un logiciel est
 * remis en concurrence plusieurs fois au fil des années, et « le devis retenu »
 * n'a de sens que rapporté à la consultation qui l'a choisi.
 *
 * Saisie en UNE étape : le formulaire porte le fichier avec les informations,
 * et l'écran enchaîne création puis dépôt. Le tableau ne fait qu'afficher la
 * pièce ; la corbeille du devis les emporte tous les deux.
 */
export function DevisPanel({
  logicielId,
  consultations,
  categories,
  editeurs,
  readOnly,
}: {
  logicielId: number;
  consultations: ConsultationRow[];
  /** Référentiel des types de document, pour la liste sous le nom du fichier. */
  categories: CategorieOption[];
  /** Annuaire des sociétés, pour désigner qui a remis le devis. */
  editeurs: Array<{ id: number; nom: string }>;
  readOnly: boolean;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();

  /**
   * Type posé d'office sur les pièces déposées ici. null si la ligne a été
   * supprimée du référentiel : le dépôt reste possible, la pièce arrive
   * simplement sans type, et la liste permet de la classer après coup.
   */
  const categorieDevisId = categories.find((c) => c.label === "Devis")?.id ?? null;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Formulaire de consultation : ouvert en création ou en édition.
  const [consultationForm, setConsultationForm] = useState<
    { mode: "creation" } | { mode: "edition"; row: ConsultationRow } | null
  >(null);
  // Formulaire de devis : rattaché à une consultation, en création ou édition.
  const [devisForm, setDevisForm] = useState<{
    consultationId: number;
    row: DevisRow | null;
  } | null>(null);

  function soumettreConsultation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consultationForm) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const cible = consultationForm;
    startTransition(async () => {
      const res =
        cible.mode === "edition"
          ? await updateConsultationAction(cible.row.id, form)
          : await createConsultationAction(logicielId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConsultationForm(null);
      router.refresh();
    });
  }

  /**
   * Enregistre le devis PUIS sa pièce, en un seul geste pour qui saisit.
   *
   * L'ordre est imposé : le dépôt se rattache à un devis, qui doit donc exister
   * — d'où l'id renvoyé par createDevisAction. En modification, un nouveau
   * fichier REMPLACE l'ancien : on retire d'abord (deleteDocumentAction efface
   * aussi le fichier du disque), on dépose ensuite.
   */
  function soumettreDevis(e: React.FormEvent<HTMLFormElement>, fichier: File | null) {
    e.preventDefault();
    if (!devisForm) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const cible = devisForm;
    startTransition(async () => {
      const res = cible.row
        ? await updateDevisAction(cible.row.id, form)
        : await createDevisAction(cible.consultationId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const devisId = cible.row?.id ?? res.id;
      if (fichier && devisId !== undefined) {
        if (cible.row?.document) {
          const retrait = await deleteDocumentAction(cible.row.document.id);
          if (!retrait.ok) {
            // Le devis est enregistré, la pièce non : on le dit plutôt que de
            // refermer le formulaire sur un demi-résultat.
            setError(
              `Devis enregistré, mais la pièce n'a pas pu être remplacée : ${retrait.error}`,
            );
            router.refresh();
            return;
          }
        }
        const echec = await deposerPiece(devisId, fichier, categorieDevisId);
        if (echec) {
          setError(`Devis enregistré, mais le dépôt a échoué : ${echec}`);
          router.refresh();
          return;
        }
      }
      setDevisForm(null);
      router.refresh();
    });
  }

  async function supprimerConsultation(c: ConsultationRow) {
    const ok = await confirmer({
      question: `Supprimer la consultation « ${c.objet} » ?`,
      detail: c.devis.length > 0 ? `Ses ${c.devis.length} devis seront supprimés.` : undefined,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteConsultationAction(c.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  async function supprimerDevis(d: DevisRow) {
    // Le fichier nomme le devis quand il y en a un : deux devis d'un même
    // fournisseur ne se distinguent que par là. Sinon, le fournisseur.
    const quoi = d.document
      ? `le devis « ${d.document.nomOriginal} »`
      : `le devis de « ${nomDe(d)} »`;
    const ok = await confirmer({
      question: `Supprimer ${quoi} ?`,
      // La pièce part avec la ligne, et le disque ne la garde pas.
      detail: d.document ? DETAIL_FICHIER_DEFINITIF : undefined,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDevisAction(d.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  /**
   * Une suppression efface les devis (et leurs documents) par CASCADE
   * PostgreSQL, qui ne retire pas les fichiers du disque : tant qu'une pièce
   * pend là-dessous, la corbeille reste grisée et l'infobulle dit quoi faire.
   * L'action serveur applique la même règle.
   */
  const piecesDe = (c: ConsultationRow) => c.devis.filter((d) => d.document).length;

  const libellePieces = (n: number) => (n === 1 ? "1 pièce jointe" : `${n} pièces jointes`);

  /** Un clic marque ; un clic sur le devis DÉJÀ retenu le démarque. */
  function basculerRetenu(d: DevisRow) {
    setError(null);
    startTransition(async () => {
      const res = await marquerDevisRetenuAction(d.id, !d.retenu);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="alert-error">{error}</p> : null}

      <Card
        title="Mises en concurrence"
        actions={
          readOnly ? undefined : (
            <button
              type="button"
              className="btn-secondary !py-1.5"
              onClick={() =>
                setConsultationForm((f) => (f?.mode === "creation" ? null : { mode: "creation" }))
              }
            >
              {consultationForm?.mode === "creation" ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {consultationForm?.mode === "creation" ? "Fermer" : "Ajouter une consultation"}
            </button>
          )
        }
      >
        {consultationForm ? (
          <form
            key={consultationForm.mode === "edition" ? `c-${consultationForm.row.id}` : "c-new"}
            onSubmit={soumettreConsultation}
            className="mb-5 rounded-xl border border-sub bg-inset p-4"
          >
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              <Field label="Objet de la consultation" htmlFor="objet" required>
                <input
                  id="objet"
                  name="objet"
                  required
                  placeholder="Ex. Renouvellement 2026, migration vers la version web"
                  maxLength={150}
                  defaultValue={
                    consultationForm.mode === "edition" ? consultationForm.row.objet : ""
                  }
                  disabled={pending}
                  className="input"
                />
              </Field>
              <Field label="Date de la consultation" htmlFor="dateConsultation">
                <input
                  id="dateConsultation"
                  name="date"
                  type="date"
                  defaultValue={
                    consultationForm.mode === "edition" ? consultationForm.row.date : ""
                  }
                  disabled={pending}
                  className="input"
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => setConsultationForm(null)}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : null}

        {consultations.length === 0 ? (
          <EmptyState>
            Aucune mise en concurrence enregistrée. Une consultation regroupe les devis reçus pour
            un même besoin.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {consultations.map((c) => (
              // `bg-page` : même traitement que les marchés de l'onglet
              // Contrats — le fond des pages, plus sourd que la carte qui les
              // contient, détache chaque consultation comme un bloc.
              <section key={c.id} className="rounded-xl border border-line bg-page">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-strong">{c.objet}</span>
                    <span className="text-xs text-faint">
                      {[
                        c.date || null,
                        `${c.devis.length} devis`,
                        c.devis.some((d) => d.retenu) ? null : "aucun retenu",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {readOnly ? null : (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="btn-secondary !py-1.5"
                        disabled={pending}
                        onClick={() =>
                          setDevisForm((f) =>
                            f?.consultationId === c.id && f.row === null
                              ? null
                              : { consultationId: c.id, row: null },
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Devis
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !p-2"
                        title="Modifier la consultation"
                        disabled={pending}
                        onClick={() => setConsultationForm({ mode: "edition", row: c })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !p-2 hover:!text-danger"
                        title={
                          piecesDe(c) > 0
                            ? `Suppression impossible : ${libellePieces(piecesDe(c))} sous ses devis, à retirer d'abord.`
                            : "Supprimer la consultation"
                        }
                        disabled={pending || piecesDe(c) > 0}
                        onClick={() => supprimerConsultation(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </header>

                <div className="p-4">
                  {/* Ajout : le formulaire se pose au-dessus du tableau, il n'y
                      a pas encore de ligne. En MODIFICATION il prend la place de
                      la ligne concernée, plus bas — on garde ainsi sous les yeux
                      le devis qu'on est en train de retoucher. */}
                  {devisForm?.consultationId === c.id && devisForm.row === null ? (
                    <FormulaireDevis
                      key={`d-new-${c.id}`}
                      row={null}
                      editeurs={editeurs}
                      pending={pending}
                      onSubmit={soumettreDevis}
                      onCancel={() => setDevisForm(null)}
                    />
                  ) : null}

                  {c.devis.length === 0 ? (
                    <p className="text-sm text-faint">Aucun devis reçu pour cette consultation.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Devis</th>
                            <th>Fournisseur</th>
                            <th className="text-right">Montant</th>
                            <th>Date</th>
                            {readOnly ? null : <th className="w-20" aria-label="Actions" />}
                          </tr>
                        </thead>
                        <tbody>
                          {c.devis.map((d) =>
                            // La ligne en cours de modification cède sa place au
                            // formulaire, sur toute la largeur du tableau.
                            devisForm?.row?.id === d.id ? (
                              <tr key={d.id}>
                                <td colSpan={readOnly ? 4 : 5} className="!py-2 !pr-0">
                                  <FormulaireDevis
                                    key={`d-${d.id}`}
                                    row={d}
                                    editeurs={editeurs}
                                    pending={pending}
                                    onSubmit={soumettreDevis}
                                    onCancel={() => setDevisForm(null)}
                                    className="rounded-xl border border-sub bg-inset p-4"
                                  />
                                </td>
                              </tr>
                            ) : (
                              <tr key={d.id}>
                                {/* Liseré vert sur le devis retenu. Posé sur TOUTES
                                  les lignes, transparent par défaut : sans cela
                                  la ligne marquée se décalerait de 2 px. */}
                                <td
                                  className={`border-l-2 ${d.retenu ? "border-ok" : "border-transparent"}`}
                                >
                                  <PieceDevis
                                    document={d.document}
                                    categories={categories}
                                    readOnly={readOnly}
                                    onErreur={setError}
                                  />
                                </td>
                                <td className="font-medium text-strong">
                                  {d.fournisseurNom ?? (
                                    <span title="Société non renseignée">—</span>
                                  )}
                                </td>
                                <td className="text-right tabular-nums">
                                  {formatEuros(d.montant) ?? "—"}
                                </td>
                                <td>{d.date || "—"}</td>
                                {readOnly ? null : (
                                  <td>
                                    <span className="flex items-center gap-1">
                                      {/* La marque « retenu » vit avec les autres
                                        actions de la ligne : elle n'a plus sa
                                        colonne, qui coûtait 40 px sans en-tête
                                        pour un geste rare. Étoile pleine = ce
                                        devis est celui qui a été choisi. */}
                                      <button
                                        type="button"
                                        className={`btn-ghost !p-2 ${d.retenu ? "!text-ok" : ""}`}
                                        title={
                                          d.retenu
                                            ? "Devis retenu — cliquer pour démarquer"
                                            : "Marquer ce devis comme retenu"
                                        }
                                        aria-pressed={d.retenu}
                                        disabled={pending}
                                        onClick={() => basculerRetenu(d)}
                                      >
                                        <Star
                                          className={`h-4 w-4 ${d.retenu ? "fill-current" : ""}`}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-ghost !p-2"
                                        title="Modifier le devis"
                                        disabled={pending}
                                        onClick={() =>
                                          setDevisForm({ consultationId: c.id, row: d })
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      {/* Jamais grisée : c'est la corbeille du
                                        devis ENTIER, pièce comprise — voir
                                        deleteDevisAvecPieces. */}
                                      <button
                                        type="button"
                                        className="btn-ghost !p-2 hover:!text-danger"
                                        title={
                                          d.document
                                            ? "Supprimer le devis et sa pièce jointe"
                                            : "Supprimer le devis"
                                        }
                                        disabled={pending}
                                        onClick={() => supprimerDevis(d)}
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

/** Libellé d'un devis dans les messages : la société, à défaut son montant. */
function nomDe(d: DevisRow): string {
  return d.fournisseurNom || formatEuros(d.montant) || "société non renseignée";
}

/**
 * Dépose la pièce d'un devis. Renvoie null si tout s'est bien passé, sinon le
 * message d'erreur — l'appelant décide quoi en dire.
 *
 * Route API et non server action : c'est un flux binaire.
 */
async function deposerPiece(
  devisId: number,
  fichier: File,
  categorieDevisId: number | null,
): Promise<string | null> {
  try {
    const form = new FormData();
    form.set("file", fichier);
    form.set("devisId", String(devisId));
    if (categorieDevisId !== null) form.set("categorieId", String(categorieDevisId));
    const r = await fetch("/api/documents/upload", { method: "POST", body: form });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return j.error ?? "le dépôt a échoué, réessayez.";
    return null;
  } catch {
    return "le dépôt a échoué (réseau), réessayez.";
  }
}

/**
 * La pièce d'un devis, dans sa cellule : nom cliquable et téléchargement, puis
 * type, taille, déposant et date en dessous. Même gabarit que l'onglet
 * Documents ; le type est posé sur « Devis » au dépôt mais reste modifiable.
 *
 * PUREMENT un affichage : le dépôt se fait dans le formulaire du devis (une
 * seule étape pour saisir la ligne et joindre le PDF), et le retrait passe par
 * la corbeille du devis, qui emporte les deux.
 */
function PieceDevis({
  document,
  categories,
  readOnly,
  onErreur,
}: {
  document: DocumentRow | null;
  categories: CategorieOption[];
  readOnly: boolean;
  onErreur: (message: string | null) => void;
}) {
  // Sans pièce : rien à proposer ici, le dépôt se fait en modifiant le devis.
  if (!document) return <span className="text-faint">—</span>;
  return (
    <LigneDocument
      document={document}
      categories={categories}
      readOnly={readOnly}
      onErreur={onErreur}
    />
  );
}

/**
 * Saisie d'un devis : le fichier D'ABORD, puis les informations. Tout part en
 * un seul envoi — la ligne est créée, la pièce déposée dans la foulée.
 *
 * Le fichier est retenu ici, en mémoire, jusqu'à la validation : avant elle il
 * n'existe aucun devis auquel le rattacher.
 */
function FormulaireDevis({
  row,
  editeurs,
  pending,
  onSubmit,
  onCancel,
  className = "mb-3 rounded-xl border border-sub bg-inset p-4",
}: {
  row: DevisRow | null;
  editeurs: Array<{ id: number; nom: string }>;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, fichier: File | null) => void;
  onCancel: () => void;
  /** Habillage : la marge basse saute quand le formulaire tient dans une ligne. */
  className?: string;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Société choisie et annuaire local : une société créée depuis la modale doit
  // apparaître dans la liste ET s'y sélectionner sans recharger la page. Le
  // select est donc contrôlé, contrairement aux autres champs du formulaire.
  const [fournisseurId, setFournisseurId] = useState(row?.fournisseurId ?? "");
  const [annuaire, setAnnuaire] = useState(editeurs);
  const [modale, setModale] = useState(false);

  return (
    <form onSubmit={(e) => onSubmit(e, fichier)} className={className}>
      {/* Les quatre champs sur UNE rangée. Pas une grille en colonnes égales :
          le bouton, le montant et la date ont chacun une largeur incompressible
          et le tiers ne les arrange pas. Chacun porte donc sa largeur propre, le
          fournisseur prenant le reste ; en dessous de la place nécessaire, la
          rangée se replie au lieu d'écraser les champs. */}
      <div className="flex flex-wrap items-start gap-4">
        {/* Largeur calée sur le bouton à sa taille naturelle : plus large, il
            paraît étiré ; plus étroit, son libellé se coupe en deux. */}
        <div className="w-full sm:w-44">
          <Field
            label="Devis"
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
            {/* `w-full` : le bouton occupe toute sa colonne, sinon l'espace laissé
              à sa droite s'ajoute à l'écart avec le champ suivant et la rangée
              paraît mal alignée. La croix d'annulation passe sous le bouton,
              avec le nom retenu — la mettre à côté le rétrécissait au point de
              couper son libellé sur deux lignes. */}
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
        <div className="w-full min-w-56 sm:flex-1">
          <Field
            label="Fournisseur"
            htmlFor="fournisseurId"
            hint="La société qui a remis le devis. Vide si elle n'est pas encore dans l'annuaire."
          >
            <span className="flex items-center gap-1">
              <select
                id="fournisseurId"
                name="fournisseurId"
                value={fournisseurId}
                onChange={(e) => setFournisseurId(e.target.value)}
                disabled={pending}
                className="input min-w-0 flex-1"
              >
                <option value="">— non renseigné —</option>
                {annuaire.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.nom}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary shrink-0 !px-2.5"
                title="Créer une société absente de l'annuaire"
                aria-label="Créer une société absente de l'annuaire"
                disabled={pending}
                onClick={() => setModale(true)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </span>
          </Field>
        </div>
        <div className="shrink-0">
          <Field label="Montant" htmlFor="montant" hint="En euros TTC.">
            {/* Taillé sur le plus grand montant que la base accepte
              (Decimal(12,2) → 9999999999,99), séparateurs de milliers compris
              puisque la saisie « 9 999 999 999,99 » est relue telle quelle. */}
            <input
              id="montant"
              name="montant"
              inputMode="decimal"
              defaultValue={row?.montant ?? ""}
              disabled={pending}
              className="input !w-[19ch]"
            />
          </Field>
        </div>
        <div className="shrink-0">
          <Field label="Date du devis" htmlFor="dateDevis">
            {/* `!w-auto` : un champ date a une largeur intrinsèque (jj/mm/aaaa +
              son icône), l'étirer sur toute la colonne ne sert à rien. */}
            <input
              id="dateDevis"
              name="date"
              type="date"
              defaultValue={row?.date ?? ""}
              disabled={pending}
              className="input !w-auto"
            />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={onCancel}>
          Annuler
        </button>
      </div>
      {/* La marque « retenu » se pose depuis le tableau : elle engage les AUTRES
          devis de la consultation (démarquage), ce qu'un champ de formulaire ne
          laisserait pas deviner. */}

      {modale ? (
        <ModaleSociete
          onFermer={() => setModale(false)}
          onCreee={(societe) => {
            // Insérée dans l'ordre alphabétique, comme la liste du serveur, et
            // sélectionnée aussitôt : c'est pour ce devis-ci qu'on l'a créée.
            setAnnuaire((liste) =>
              [...liste, societe].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
            );
            setFournisseurId(String(societe.id));
            setModale(false);
          }}
        />
      ) : null}
    </form>
  );
}

/**
 * Création d'une société absente de l'annuaire sans quitter la saisie du devis.
 * Reprend les MÊMES champs que « Éditeurs › Nouveau » (coordonnées, support,
 * notes) : la fiche créée ici n'est pas un brouillon à compléter ailleurs.
 *
 * Pas de <form> ici : la modale s'affiche À L'INTÉRIEUR du formulaire de devis,
 * et un formulaire imbriqué est invalide en HTML. D'où les champs relus à la
 * main depuis le conteneur, la soumission au clic, et l'interception d'Entrée
 * qui validerait sinon le devis lui-même.
 */
function ModaleSociete({
  onFermer,
  onCreee,
}: {
  onFermer: () => void;
  onCreee: (societe: { id: number; nom: string }) => void;
}) {
  const champsRef = useRef<HTMLDivElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function creer() {
    const conteneur = champsRef.current;
    if (!conteneur) return;
    // Faute de <form>, on reconstitue le FormData depuis les champs nommés :
    // les mêmes clés que la page éditeur, donc la même server action.
    const form = new FormData();
    for (const el of conteneur.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[name]")) {
      form.set(el.name, el.value);
    }
    const nom = String(form.get("nom") ?? "").trim();
    if (nom === "") {
      setErreur("Le nom de l'éditeur est obligatoire.");
      return;
    }
    setErreur(null);
    startTransition(async () => {
      const res = await createEditeurAction(form);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      if (res.id === undefined) {
        setErreur("Société créée, mais impossible de la sélectionner. Rechargez la page.");
        return;
      }
      onCreee({ id: res.id, nom });
    });
  }

  // Même règle que la fiche éditeur : un simple exemple de format part en
  // `placeholder`, qui n'ajoute pas de ligne sous le champ.
  const champ = (
    name: string,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string; id?: string },
  ) => {
    const id = opts?.id ?? `soc-${name}`;
    return (
      <Field label={label} htmlFor={id} hint={opts?.hint}>
        <input
          id={id}
          name={name}
          type={opts?.type ?? "text"}
          placeholder={opts?.placeholder}
          disabled={pending}
          className="input"
        />
      </Field>
    );
  };

  return (
    // Le fond ferme la modale au clic ; au clavier, Échap et le bouton Annuler
    // font le même travail.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onFermer();
        // Entrée validerait le formulaire de DEVIS en dessous. On la détourne
        // vers la création — sauf dans les notes, où elle sert à aller à la ligne.
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          creer();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-societe"
        className="my-8 w-full max-w-2xl rounded-2xl border border-line bg-surface px-5 py-4 shadow-lg"
      >
        <h3
          id="titre-societe"
          className="mb-3 text-sm font-bold uppercase tracking-wider text-muted"
        >
          Nouvel éditeur
        </h3>
        {erreur ? <p className="alert-error mb-3">{erreur}</p> : null}

        <div ref={champsRef} className="space-y-5">
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <Field label="Nom de l'éditeur" htmlFor="soc-nom" required>
              <input
                // biome-ignore lint/a11y/noAutofocus: la modale vient d'être ouverte par un clic délibéré sur « + ».
                autoFocus
                id="soc-nom"
                name="nom"
                required
                maxLength={150}
                disabled={pending}
                className="input"
              />
            </Field>
            {champ("siteWeb", "Site web", { type: "url", placeholder: "https://…" })}
            {champ("adresse", "Adresse")}
            <div className="grid grid-cols-[8rem_1fr] gap-4">
              {champ("codePostal", "Code postal")}
              {champ("ville", "Ville")}
            </div>
            {champ("telephone", "Téléphone", { type: "tel" })}
            {champ("email", "E-mail", { type: "email" })}
          </div>

          <div className="border-t border-line pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Support</p>
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              {champ("supportUrl", "Portail de tickets", {
                type: "url",
                placeholder: "https://…",
              })}
              {champ("supportEmail", "E-mail du support", { type: "email" })}
              {champ("supportTelephone", "Téléphone du support", { type: "tel" })}
              {champ("supportHoraires", "Horaires", { placeholder: "Ex. lun-ven 9h-18h" })}
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Notes</p>
            <textarea
              name="notes"
              rows={3}
              disabled={pending}
              className="input"
              placeholder="Informations libres : interlocuteurs, historique, particularités du contrat…"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={creer}>
            {pending ? "Création…" : "Créer l'éditeur"}
          </button>
          <button type="button" className="btn-secondary" disabled={pending} onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
