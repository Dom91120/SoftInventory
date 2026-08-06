"use client";

import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteDocumentAction, updateDocumentCategorieAction } from "@/app/(app)/documents/actions";
import {
  type CategorieOption,
  type DocumentRow,
  LigneDocument,
} from "@/components/documents-panel";
import { Card, EmptyState, Field } from "@/components/ui";
import { DATE_FMT_FR_UTC, formatEuros } from "@/lib/format";
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
  /** Date du document (signature, notification) — AAAA-MM-JJ ou "". Sans rappel. */
  datePiece: string;
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
  /** Montant annuel du marché entier (Decimal sérialisé ; "" si null). */
  montantAnnuel: string;
  /** Maximum annuel, quand l'acte en fixe un (Decimal sérialisé ; "" si null). */
  montantMaxi: string;
  /** Le marché sur sa durée entière (Decimal sérialisé ; "" si null). */
  montantTotal: string;
  /** Prise d'effet du marché, AAAA-MM-JJ ou "". */
  dateDebut: string;
  /** Terme du marché, AAAA-MM-JJ ou "". Aucun rappel ne s'y accroche. */
  dateFin: string;
  notes: string;
  pieces: PieceContratRow[];
};

/**
 * "AAAA-MM-JJ" → "JJ/MM/AAAA". Ancrée en UTC comme la colonne `@db.Date` : sans
 * cela, un poste à l'ouest de Greenwich reculerait l'affichage d'un jour.
 */
function enDateFr(iso: string): string {
  return DATE_FMT_FR_UTC.format(new Date(`${iso}T00:00:00.000Z`));
}

/**
 * Période d'un marché : « du 01/01/2024 au 31/12/2028 ». Une seule borne se dit
 * autrement — un marché en cours a souvent un début connu et un terme qui ne
 * l'est pas, et l'inverse se rencontre sur les reprises d'historique. Renvoie
 * null quand aucune date n'est saisie : l'appelant n'affiche alors rien.
 */
function periodeDe(debut: string, fin: string): string | null {
  if (debut && fin) return `du ${enDateFr(debut)} au ${enDateFr(fin)}`;
  if (debut) return `à partir du ${enDateFr(debut)}`;
  if (fin) return `jusqu'au ${enDateFr(fin)}`;
  return null;
}

/**
 * Un marché est terminé quand son terme est passé. DÉDUIT, jamais stocké : un
 * état enregistré se désynchroniserait de la date le lendemain de l'échéance,
 * et il faudrait un traitement pour le tenir à jour.
 *
 * Comparaison de chaînes AAAA-MM-JJ : à ce format l'ordre lexical est l'ordre
 * chronologique, ce qui évite de fabriquer des Date et de raisonner sur les
 * fuseaux. Le jour du terme, le marché court encore.
 */
function estTermine(dateFin: string, aujourdhui: string): boolean {
  return dateFin !== "" && dateFin < aujourdhui;
}

/**
 * Marché encore en cours dont le terme approche : il faut relancer une
 * consultation. La borne haute vient du serveur, qui la calcule sur le délai de
 * rappel — la pastille et l'e-mail se déclenchent donc au même moment.
 *
 * Exclusif de `estTermine` : le terme est soit passé, soit à venir.
 */
function estARenouveler(dateFin: string, aujourdhui: string, limite: string): boolean {
  return dateFin !== "" && dateFin >= aujourdhui && dateFin <= limite;
}

/**
 * Catégorie proposée d'office dans le formulaire d'une pièce. « Marché » existe
 * aussi dans le référentiel : la liste reste ouverte, c'est un choix au cas par
 * cas. Rapproché par LIBELLÉ et non par id — le référentiel est saisi par
 * l'admin, qui peut renommer ou supprimer l'entrée, d'où le repli sur null.
 */
const CATEGORIE_PAR_DEFAUT = "Contrat";

/**
 * Onglet Contrats : les contrats et marchés du logiciel et, sous chacun, ses
 * pièces. Même organisation que l'onglet Devis, pour la même raison : le marché
 * dit AVEC QUI on s'engage, sous quelle référence, pour COMBIEN AU TOTAL et
 * JUSQU'À QUAND ; la pièce détaille poste par poste ce que coûte chacun et
 * quand il se renouvelle. Un marché couvre souvent plusieurs postes aux termes
 * distincts, et sa propre échéance ne se déduit pas des leurs.
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
  aujourdhui,
  limiteRenouvellement,
  readOnly,
}: {
  logicielId: number;
  contrats: ContratRow[];
  /** Référentiel des catégories, pour la liste du formulaire d'une pièce. */
  categories: CategorieOption[];
  /** Annuaire des sociétés, pour désigner un revendeur. */
  editeurs: Array<{ id: number; nom: string }>;
  /** Éditeur du logiciel : fournisseur par défaut quand le marché n'en nomme pas. */
  editeurDuLogiciel: string | null;
  nbUtilisateurs: number | null;
  nbMaxUtilisateurs: number | null;
  /** Jour courant en AAAA-MM-JJ, fourni par le serveur — voir son appel. */
  aujourdhui: string;
  /** Dernier jour de la fenêtre « à renouveler », AAAA-MM-JJ. Même origine. */
  limiteRenouvellement: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categorieParDefautId = categories.find((c) => c.label === CATEGORIE_PAR_DEFAUT)?.id ?? null;

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
   *
   * La catégorie saisie porte sur le DOCUMENT, pas sur la pièce : elle part au
   * dépôt s'il y a un fichier, sinon elle reclasse celui déjà en place. Sans
   * fichier ni avant ni après, elle n'a rien à qualifier et se perd — c'est la
   * conséquence assumée d'une catégorie qui appartient au document.
   */
  function soumettrePiece(e: React.FormEvent<HTMLFormElement>, fichier: File | null) {
    e.preventDefault();
    if (!pieceForm) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const cible = pieceForm;
    const brut = String(form.get("categorieId") ?? "");
    const categorieId = brut === "" ? null : Number(brut);
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
        const echec = await deposerPiece(pieceId, fichier, categorieId);
        if (echec) {
          setError(`Pièce enregistrée, mais le dépôt a échoué : ${echec}`);
          router.refresh();
          return;
        }
      } else if (cible.row?.document && categorieId !== cible.row.document.categorieId) {
        // Pas de nouveau fichier, mais la catégorie a bougé : elle s'applique au
        // document déjà rattaché. Comparaison utile — sans elle, chaque
        // enregistrement rejouerait une écriture inutile.
        const maj = await updateDocumentCategorieAction(cible.row.document.id, categorieId);
        if (!maj.ok) {
          setError(`Pièce enregistrée, mais la catégorie du fichier n'a pas suivi : ${maj.error}`);
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
    // Le type nommait la pièce dans cette question ; à sa place, ce qui la
    // distingue encore de ses voisines — son fichier, sinon sa date.
    const nom = l.document?.nomOriginal ?? l.datePiece;
    const quoi = nom ? `la pièce « ${nom} »` : "cette pièce";
    if (!window.confirm(`Supprimer ${quoi} ?${avert}`)) return;
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
    <div className="space-y-3">
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
                        restante et se coupe en « … » quand il déborde.

                        Largeurs en `rem` et JAMAIS en `ch`, malgré l'attrait de
                        cette dernière pour raisonner en caractères : elle suit
                        la police, or les deux rangées n'ont pas la même taille
                        (text-sm / text-xs). Un `3ch` y valait 25,9 px et
                        21,6 px, et les colonnes cessaient de tomber au même
                        endroit. Le gabarit doit rester strictement identique
                        entre les deux rangées.

                        Référence 6.25rem (100 px) et montants 16.25rem (260 px,
                        le minimum pour « Mnt annuel : 999 999,99 € · Maxi :
                        999 999,99 € », mesuré à 258,14 px). Tout ce qui n'est
                        pas pris par ces deux-là revient au libellé, seul à
                        s'étirer — les élargir le raccourcit d'autant. */}
                    <span className="grid grid-cols-[minmax(3rem,6.25rem)_minmax(8rem,1fr)_minmax(6rem,16.25rem)] items-baseline gap-2 font-semibold text-strong">
                      <span className="truncate" title={c.referenceMarche || undefined}>
                        {c.referenceMarche}
                      </span>
                      {/* Le badge accompagne le LIBELLÉ, pas la période : c'est
                          le marché qui est terminé, pas ses dates. `shrink-0`
                          le préserve — le libellé se coupe avant lui. */}
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate" title={c.libelle || undefined}>
                          {c.libelle || (c.referenceMarche ? "" : "sans libellé")}
                        </span>
                        {/* Gris, mais un cran plus soutenu que `badge-muted`,
                            dont le fond `inset` (#f1f5f9) se confondait avec le
                            texte secondaire alentour. `sub` (#cbd5e1) se
                            détache sans crier — ni l'ambre ni le rouge, qui
                            désignent dans la charte une échéance proche ou un
                            retard : un marché arrivé à son terme est un fait,
                            pas une anomalie. `line` aurait été trop proche de
                            l'ancien pour que la différence se voie. */}
                        {estTermine(c.dateFin, aujourdhui) ? (
                          <span
                            className="badge shrink-0 bg-sub text-body"
                            title={`Terminé depuis le ${enDateFr(c.dateFin)}`}
                          >
                            Terminé
                          </span>
                        ) : estARenouveler(c.dateFin, aujourdhui, limiteRenouvellement) ? (
                          // Ambre, cette fois à bon droit : la charte lui donne
                          // le sens d'« échéance proche », et il y a ici quelque
                          // chose à FAIRE avant une date — au contraire d'un
                          // marché terminé, qui ne se constate que.
                          <span
                            className="badge-warn shrink-0"
                            title={`À renouveler avant le ${enDateFr(c.dateFin)}`}
                          >
                            À renouveler
                          </span>
                        ) : null}
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
                    {/* Deuxième rangée, MÊME gabarit de colonnes que le titre :
                        la date de fin tombe ainsi sous le libellé et le montant
                        sous le fournisseur, ce qu'ils qualifient chacun. Les
                        deux se taisent quand ils ne sont pas renseignés — un
                        marché sans terme saisi n'a pas à afficher un tiret. */}
                    <span className="grid grid-cols-[minmax(3rem,6.25rem)_minmax(8rem,1fr)_minmax(6rem,16.25rem)] items-baseline gap-2 text-xs text-faint">
                      <span>{`${c.pieces.length} pièce${c.pieces.length > 1 ? "s" : ""}`}</span>
                      <span className="truncate">{periodeDe(c.dateDebut, c.dateFin)}</span>
                      {/* « Mnt annuel » abrégé : les deux montants partagent
                          une colonne qui contenait déjà tout juste le premier.
                          Le plafond ne s'affiche que s'il est saisi — tous les
                          actes n'en fixent pas. `title` porte les libellés
                          entiers, la colonne tronquant au besoin. */}
                      <span
                        className="truncate tabular-nums"
                        title={
                          [
                            c.montantAnnuel
                              ? `Montant annuel : ${formatEuros(c.montantAnnuel)}`
                              : null,
                            c.montantMaxi ? `Maximum annuel : ${formatEuros(c.montantMaxi)}` : null,
                            c.montantTotal
                              ? `Montant total du marché : ${formatEuros(c.montantTotal)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" — ") || undefined
                        }
                      >
                        {[
                          c.montantAnnuel ? `Mnt annuel : ${formatEuros(c.montantAnnuel)}` : null,
                          c.montantMaxi ? `Maxi : ${formatEuros(c.montantMaxi)}` : null,
                          c.montantTotal ? `Total : ${formatEuros(c.montantTotal)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                  {readOnly ? null : (
                    <span className="flex shrink-0 items-center gap-1">
                      {/* `!px-3` : plus resserré que le `px-4` de .btn — l'icône
                          et un mot de cinq lettres n'ont pas besoin d'autant de
                          marge, et la place gagnée revient à l'en-tête du
                          marché, qui est à l'étroit. */}
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5"
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
                      categories={categories}
                      categorieParDefautId={categorieParDefautId}
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
                            {/* La ligne EST la pièce : l'en-tête la nomme et
                                s'accorde à leur nombre. Sa catégorie ET sa date
                                se lisent sous son nom, dans LigneDocument —
                                d'où l'absence de colonnes dédiées. */}
                            <th>{c.pieces.length > 1 ? "Pièces" : "Pièce"}</th>
                            {readOnly ? null : <th className="w-20" aria-label="Actions" />}
                          </tr>
                        </thead>
                        <tbody>
                          {c.pieces.map((l) =>
                            pieceForm?.row?.id === l.id ? (
                              <tr key={l.id}>
                                <td colSpan={readOnly ? 1 : 2} className="!py-2 !pr-0">
                                  <FormulairePiece
                                    key={`p-${l.id}`}
                                    row={l}
                                    categories={categories}
                                    categorieParDefautId={categorieParDefautId}
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
                                      // Le crayon de la pièce porte la catégorie
                                      // et la date : elles se lisent ici, elles
                                      // s'y modifient.
                                      categorieModifiable={false}
                                      dateLigne={l.datePiece ? enDateFr(l.datePiece) : ""}
                                      onErreur={setError}
                                    />
                                  ) : (
                                    // Sans fichier, LigneDocument ne s'affiche
                                    // pas — et la date de la pièce, qui vit à
                                    // l'intérieur, disparaîtrait avec elle.
                                    // Elle se replie donc ici, seule.
                                    <span className="text-faint">
                                      {l.datePiece ? enDateFr(l.datePiece) : "—"}
                                    </span>
                                  )}
                                </td>
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

/**
 * Le marché : ce qui l'identifie, et ce qui l'engage en bloc — montant annuel et
 * date de fin. Le détail poste par poste reste sur ses pièces.
 */
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
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
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
        <Field label="Montant annuel (€)" htmlFor="montantAnnuel">
          <input
            id="montantAnnuel"
            name="montantAnnuel"
            inputMode="decimal"
            defaultValue={row?.montantAnnuel ?? ""}
            disabled={pending}
            className="input"
          />
        </Field>
        <Field label="Maximum annuel (€)" htmlFor="montantMaxi">
          <input
            id="montantMaxi"
            name="montantMaxi"
            inputMode="decimal"
            defaultValue={row?.montantMaxi ?? ""}
            disabled={pending}
            className="input"
          />
        </Field>
        <Field label="Montant total du marché (€)" htmlFor="montantTotal">
          <input
            id="montantTotal"
            name="montantTotal"
            inputMode="decimal"
            defaultValue={row?.montantTotal ?? ""}
            disabled={pending}
            className="input"
          />
        </Field>
        <Field label="Date de début" htmlFor="dateDebut" hint="Prise d'effet du marché.">
          <input
            id="dateDebut"
            name="dateDebut"
            type="date"
            defaultValue={row?.dateDebut ?? ""}
            disabled={pending}
            className="input"
          />
        </Field>
        <Field
          label="Date de fin"
          htmlFor="dateFin"
          hint="Terme du marché. Ne déclenche pas de rappel : celui-ci suit le renouvellement de chaque pièce."
        >
          <input
            id="dateFin"
            name="dateFin"
            type="date"
            defaultValue={row?.dateFin ?? ""}
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
 * La pièce : son fichier, la catégorie de ce fichier, son coût, son échéance. Le
 * fichier est retenu en mémoire jusqu'à la validation — avant elle, il n'existe
 * aucune pièce à laquelle le rattacher.
 *
 * La catégorie ne vit pas sur la pièce mais sur son document : sans fichier,
 * elle n'a rien à qualifier et ne sera appliquée qu'au dépôt.
 */
function FormulairePiece({
  row,
  categories,
  categorieParDefautId,
  pending,
  onSubmit,
  onCancel,
  className = "mb-3 rounded-xl border border-sub bg-inset p-4",
}: {
  row: PieceContratRow | null;
  categories: CategorieOption[];
  /** « Contrat » du référentiel ; null s'il a été renommé ou supprimé. */
  categorieParDefautId: number | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, fichier: File | null) => void;
  onCancel: () => void;
  /** Habillage : la marge basse saute quand le formulaire tient dans une ligne de tableau. */
  className?: string;
}) {
  const [fichier, setFichier] = useState<File | null>(null);

  /**
   * Ce qui EXISTE prime sur ce qui est proposé : un fichier déjà classé rouvre
   * sur SA catégorie, jamais sur le défaut — sans quoi le crayon reclasserait
   * en « Contrat » à la simple validation.
   *
   * « Sans catégorie » n'est plus une valeur offerte : la liste n'a plus
   * d'option vide. Un document hérité qui n'en aurait pas retombe donc sur le
   * défaut, comme une pièce neuve — c'est voulu, il faut bien le classer.
   */
  const categorieInitiale =
    row?.document?.categorieId != null
      ? String(row.document.categorieId)
      : categorieParDefautId === null
        ? ""
        : String(categorieParDefautId);
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
          <Field label="Catégorie du document" htmlFor="categorieId">
            <select
              id="categorieId"
              name="categorieId"
              defaultValue={categorieInitiale}
              disabled={pending}
              className="input !w-auto"
            >
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="shrink-0">
          <Field
            label="Date de la pièce"
            htmlFor="datePiece"
            hint="Date du document : signature, notification. L'échéance, elle, se saisit sur le marché."
          >
            <input
              id="datePiece"
              name="datePiece"
              type="date"
              defaultValue={row?.datePiece ?? ""}
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
