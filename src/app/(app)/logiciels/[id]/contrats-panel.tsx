"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type CategorieOption, LigneDocument } from "@/components/documents-panel";
import { ChampsMarche } from "@/components/marche-champs";
import { FormulairePiece, type PieceContratRow, usePieceContrat } from "@/components/piece-contrat";
import { Card, EmptyState } from "@/components/ui";
import { DATE_FMT_FR_UTC, formatEuros } from "@/lib/format";
import { createContratAction, deleteContratAction, updateContratAction } from "../actions";

export type { PieceContratRow };

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
  // Formulaire de pièce : rattaché à un marché, en création ou édition. Son
  // enregistrement et sa suppression sont partagés avec la fiche du marché.
  const [pieceForm, setPieceForm] = useState<{
    contratId: number;
    row: PieceContratRow | null;
  } | null>(null);
  const piece = usePieceContrat(setError);

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
        {/* Création seulement : il n'y a pas encore de ligne où se poser. La
            MODIFICATION, elle, prend la place du marché concerné, plus bas —
            sans quoi le formulaire s'ouvrait en tête de panneau, loin de la
            ligne sur laquelle on venait de cliquer. */}
        {marcheForm?.mode === "creation" ? (
          <FormulaireMarche
            key="m-new"
            row={null}
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
                {/* En modification, le formulaire prend la place de la seule
                    LIGNE DE TITRE, à l'intérieur du bloc du marché : on le
                    retrouve là où on a cliqué, et ses pièces restent lisibles
                    en dessous — on modifie souvent un montant en les regardant. */}
                {marcheForm?.mode === "edition" && marcheForm.row.id === c.id ? (
                  <FormulaireMarche
                    key={`m-${c.id}`}
                    row={marcheForm.row}
                    editeurs={editeurs}
                    editeurDuLogiciel={editeurDuLogiciel}
                    pending={pending}
                    onSubmit={soumettreMarche}
                    onCancel={() => setMarcheForm(null)}
                    className="border-b border-line bg-inset p-4"
                  />
                ) : (
                  /* `gap-4` et non `gap-2` : la colonne du fournisseur touchait
                    presque le bouton « + Pièce », faute d'air entre le bloc de
                    titre et celui des actions. */
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
                              c.montantMaxi
                                ? `Maximum annuel : ${formatEuros(c.montantMaxi)}`
                                : null,
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
                )}

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
                      pending={piece.pending}
                      onSubmit={(e, fichier) =>
                        piece.soumettre(e, fichier, { contratId: c.id, row: null }, () =>
                          setPieceForm(null),
                        )
                      }
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
                                    pending={piece.pending}
                                    onSubmit={(e, fichier) =>
                                      piece.soumettre(e, fichier, { contratId: c.id, row: l }, () =>
                                        setPieceForm(null),
                                      )
                                    }
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
                                        onClick={() => piece.supprimer(l, enDateFr)}
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
  className = "mb-5 rounded-xl border border-sub bg-inset p-4",
}: {
  row: ContratRow | null;
  editeurs: Array<{ id: number; nom: string }>;
  editeurDuLogiciel: string | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  /**
   * Habillage : la marge basse sert au formulaire de CRÉATION, posé au-dessus
   * de la liste. En modification, le formulaire prend la place d'un marché dans
   * une liste déjà espacée (`space-y-5`) — la marge y ferait double emploi.
   */
  className?: string;
}) {
  return (
    <form onSubmit={onSubmit} className={className}>
      {/* Les champs viennent du module partagé avec la fiche du marché : mêmes
          libellés, mêmes aides, même grille. Seul le sens d'un fournisseur vide
          change ici — c'est l'éditeur du logiciel. */}
      <ChampsMarche
        values={row ?? undefined}
        editeurs={editeurs}
        disabled={pending}
        optionFournisseurVide={
          editeurDuLogiciel ? `— l'éditeur du logiciel (${editeurDuLogiciel}) —` : "— non précisé —"
        }
      />
      <div className="mt-3 flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : row ? "Enregistrer" : "Ajouter le contrat"}
        </button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
