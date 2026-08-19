"use client";

import { Pencil, Plus, Trash2, Unlink, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { attacherLogicielAction, detacherLogicielAction } from "@/app/(app)/contrats/actions";
import { useConfirmation } from "@/components/confirmation";
import { type CategorieOption, LigneDocument } from "@/components/documents-panel";
import { ChampsMarche, MARCHE_VIDE } from "@/components/marche-champs";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { FormulairePiece, type PieceContratRow, usePieceContrat } from "@/components/piece-contrat";
import { Card, EmptyState } from "@/components/ui";
import { DATE_FMT_FR_UTC, formatEuros } from "@/lib/format";
import { LIBELLES } from "@/schemas/logiciel";
import {
  createContratAction,
  updateContratAction,
  updateMentionSansContratAction,
} from "../actions";

export type { PieceContratRow };

export type ContratRow = {
  id: number;
  /** Marché ou contrat ; "" tant que l'acte n'a pas été dépouillé. */
  nature: string;
  libelle: string;
  /** Société avec qui on contractualise ; "" = l'éditeur du logiciel. */
  fournisseurId: string;
  fournisseurNom: string | null;
  referenceMarche: string;
  referenceFournisseur: string;
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
  /** Durée ferme en années, "1" à "4" ; "" si non renseignée. */
  dureeAnnees: string;
  /** Reconductions prévues, "0" à "3" ; "" si non renseignées. */
  renouvellements: string;
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
 * Période d'un marché : « Du 01/01/2024 au 31/12/2028 ». Une seule borne se dit
 * autrement — un marché en cours a souvent un début connu et un terme qui ne
 * l'est pas, et l'inverse se rencontre sur les reprises d'historique. Renvoie
 * null quand aucune date n'est saisie : l'appelant n'affiche alors rien.
 *
 * Capitale initiale : la période OUVRE sa cellule, elle n'y prolonge aucune
 * phrase. Les deux colonnes voisines commencent de même par une majuscule.
 */
function periodeDe(debut: string, fin: string): string | null {
  if (debut && fin) return `Du ${enDateFr(debut)} au ${enDateFr(fin)}`;
  if (debut) return `À partir du ${enDateFr(debut)}`;
  if (fin) return `Jusqu'au ${enDateFr(fin)}`;
  return null;
}

/**
 * Ce que l'acte ENGAGE, quand il le dit : « (3 ans renouvelable 2 fois) ». Se
 * lit après la période, qu'il complète sans la répéter — les dates disent
 * jusqu'à quand le marché court, ceci dit pour combien de temps il a été passé
 * et combien de reconductions il prévoit.
 *
 * Chaque moitié se dit seule : tous les actes ne fixent pas les deux. « fois »
 * est invariable, seul le nombre d'années s'accorde. Zéro reconduction ne se
 * dit PAS : un marché sec est le cas ordinaire, et l'annoncer sur chaque ligne
 * ferait du bruit là où le silence dit déjà la même chose.
 *
 * Renvoie null quand rien n'est à dire : l'appelant n'affiche alors pas de
 * parenthèses vides.
 */
function engagementDe(dureeAnnees: string, renouvellements: string): string | null {
  const duree = dureeAnnees ? `${dureeAnnees} an${Number(dureeAnnees) > 1 ? "s" : ""}` : null;
  const reconductions =
    renouvellements === "" || renouvellements === "0"
      ? null
      : `renouvelable ${renouvellements} fois`;
  const dit = [duree, reconductions].filter(Boolean).join(" ");
  return dit ? `(${dit})` : null;
}

/**
 * « Marché » ou « Contrat ». Repli sur Marché quand la base ne dit rien, comme
 * le fait la liste du formulaire : les deux écrans ne doivent pas se contredire
 * sur la même ligne.
 */
function natureDe(c: ContratRow): string {
  return LIBELLES.natureMarche[c.nature === "contrat" ? "contrat" : "marche"];
}

/** Période et engagement d'un marché en une ligne, chacun se taisant s'il est vide. */
function periodeEtEngagement(c: ContratRow): string {
  return [periodeDe(c.dateDebut, c.dateFin), engagementDe(c.dureeAnnees, c.renouvellements)]
    .filter(Boolean)
    .join(" ");
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
 * Message de l'encadré quand la fiche n'a aucun marché. Il s'efface derrière
 * `mentionSansContrat` quand elle est renseignée : certaines fiches n'auront
 * jamais de marché ici parce qu'il est porté ailleurs — « Contrat géré par le
 * CCAS » — et sans ce mot le vide se lisait comme un trou dans l'inventaire.
 */
const TEXTE_SANS_CONTRAT =
  "Aucun contrat enregistré. Un contrat ou marché regroupe les pièces engagées auprès d'une même société.";

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
  mentionSansContrat,
  categories,
  editeurs,
  editeurDuLogicielId,
  marchesDisponibles,
  nbUtilisateurs,
  nbMaxUtilisateurs,
  aujourdhui,
  limiteRenouvellement,
  readOnly,
}: {
  logicielId: number;
  contrats: ContratRow[];
  /** Mention qui remplace le message standard du vide ; "" = message standard. */
  mentionSansContrat: string;
  /** Référentiel des catégories, pour la liste du formulaire d'une pièce. */
  categories: CategorieOption[];
  /** Annuaire des sociétés, pour désigner un revendeur. */
  editeurs: Array<{ id: number; nom: string }>;
  /**
   * Éditeur du logiciel : proposé d'office comme fournisseur d'un marché NEUF,
   * la valeur étant alors inscrite. Il ne sert plus à combler l'affichage d'un
   * marché sans fournisseur — un acte nomme la société du jour de sa signature
   * et ne suit pas les changements d'éditeur qui viennent après.
   */
  editeurDuLogicielId: number | null;
  /**
   * Marchés rattachables : les orphelins et ceux du même éditeur, déjà filtrés
   * par le serveur (voir `listMarchesPourRattachement`). Vide = rien à
   * proposer, et le menu disparaît.
   */
  marchesDisponibles: Array<{ id: number; nom: string }>;
  nbUtilisateurs: number | null;
  nbMaxUtilisateurs: number | null;
  /** Jour courant en AAAA-MM-JJ, fourni par le serveur — voir son appel. */
  aujourdhui: string;
  /** Dernier jour de la fenêtre « à renouveler », AAAA-MM-JJ. Même origine. */
  limiteRenouvellement: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
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
  // Saisie de la mention du vide : null = fermée, sinon la valeur en cours.
  // Ouverte sur la valeur enregistrée, elle n'est « sale » qu'une fois changée
  // — ouvrir puis refermer sans toucher ne doit rien demander à personne.
  const [mentionForm, setMentionForm] = useState<string | null>(null);
  const mentionSale = mentionForm !== null && mentionForm.trim() !== mentionSansContrat;
  const piece = usePieceContrat(setError);
  /** Poignées sur les formulaires ouverts, pour le « Enregistrer » global. */
  const formMarcheRef = useRef<HTMLFormElement>(null);
  const formPieceRef = useRef<HTMLFormElement>(null);

  /**
   * Cœur ATTENDABLE du formulaire de marché : son bouton l'appelle, et le
   * « Enregistrer » global de la fiche aussi — le marché qu'on saisissait est
   * l'œuvre du même utilisateur que le reste. Validation native d'abord.
   */
  async function envoyerMarche(form: HTMLFormElement): Promise<boolean> {
    if (!marcheForm) return true;
    if (!form.reportValidity()) return false;
    setError(null);
    const fd = new FormData(form);
    const res =
      marcheForm.mode === "edition"
        ? await updateContratAction(marcheForm.row.id, fd)
        : await createContratAction(logicielId, fd);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setMarcheForm(null);
    router.refresh();
    return true;
  }

  /**
   * Enregistre la mention du vide — même régime attendable qu'`envoyerMarche` :
   * le bouton de son formulaire l'appelle, le « Enregistrer » global aussi.
   * Vider le champ rend le message standard : "" est une valeur, pas un oubli.
   */
  async function envoyerMention(): Promise<boolean> {
    if (mentionForm === null) return true;
    setError(null);
    const res = await updateMentionSansContratAction(logicielId, mentionForm.trim());
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setMentionForm(null);
    router.refresh();
    return true;
  }

  /**
   * L'onglet lit LE mode « je modifie cette fiche » de la barre d'onglets, et
   * s'y inscrit avec ses formulaires OUVERTS : un marché ou une pièce en cours
   * de saisie est l'œuvre du même utilisateur que le reste de la fiche.
   * « Annuler » les jette avec tout le reste ; « Enregistrer » les SOUMET,
   * comme leurs propres boutons — la pièce via son formulaire, seul détenteur
   * du fichier choisi.
   */
  const mode = useInscriptionModeFiche({
    sale: () => marcheForm !== null || pieceForm !== null || mentionSale,
    rendre: () => {
      setMarcheForm(null);
      setPieceForm(null);
      setMentionForm(null);
    },
    enregistrer: async () => {
      if (marcheForm && formMarcheRef.current) {
        if (!(await envoyerMarche(formMarcheRef.current))) return false;
      }
      if (pieceForm && formPieceRef.current) {
        if (!(await piece.soumettreViaFormulaire(formPieceRef.current))) return false;
      }
      if (mentionSale) {
        if (!(await envoyerMention())) return false;
      }
      return true;
    },
  });
  const modeEdition = !!mode?.actif;
  /** Vrai quand rien ne doit pouvoir être touché — lecteur, ou crayon éteint. */
  const fige = readOnly || !modeEdition;

  const nomDe = (c: ContratRow) => c.libelle || c.referenceMarche || "sans libellé";

  function soumettreMarche(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      await envoyerMarche(form);
    });
  }

  /**
   * DÉTACHE le marché de ce logiciel — il n'est pas supprimé. Un marché couvre
   * souvent plusieurs logiciels (UGAP, marchés « communs ») : l'effacer depuis
   * la fiche de l'un le retirerait à tous les autres, sans que cet écran montre
   * lesquels. La suppression pure reste sur la fiche du marché, seul endroit
   * d'où l'on voit ce que l'on détruit.
   */
  /**
   * Rattache un marché EXISTANT dès qu'on le choisit, sans bouton de validation :
   * le geste est celui du maillon coupé à l'envers, et il se défait d'un clic
   * sur ce même maillon, à côté du marché qui vient d'apparaître.
   */
  function rattacherMarche(contratId: number) {
    setError(null);
    startTransition(async () => {
      const res = await attacherLogicielAction(contratId, logicielId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  async function detacherMarche(c: ContratRow) {
    const ok = await confirmer({
      question: `Retirer le marché « ${nomDe(c)} » de ce logiciel ?`,
      detail:
        "Le marché n'est pas supprimé : ses pièces et ses fichiers restent, et il se retrouve dans Contrats/Marchés.",
      action: "Retirer",
      // Rien ne se détruit, et le menu du haut permet de le rerattacher aussitôt.
      danger: false,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await detacherLogicielAction(c.id, logicielId);
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
            <>
              {/* Le menu et le bouton de création ne paraissent qu'une fois le
                  droit donné : offerts sous le crayon éteint, ils auraient armé
                  un rattachement — qui s'applique AU CHOIX — dans un onglet qui
                  se dit en lecture. */}
              {/* Récupérer un marché plutôt que le ressaisir : le menu voisine
                  avec « Ajouter », les deux façons de garnir la carte se
                  lisant d'un seul coup d'œil. Il se tait quand il n'a rien à
                  proposer — le cas courant d'un inventaire à jour.

                  Pas de bouton « Rattacher » : choisir DÉCLENCHE. Un bouton de
                  validation pour un geste qui se défait d'un clic sur le
                  maillon d'à côté ne protégeait de rien et coûtait une place
                  que cet en-tête n'a pas. `value=""` maintient le menu sur son
                  intitulé, qui reste ainsi une invitation et jamais le compte
                  rendu d'un choix passé. */}
              {!modeEdition || marchesDisponibles.length === 0 ? null : (
                <select
                  // `!h-[1.6rem]` — 25.6 px — et non un interligne : les
                  // navigateurs imposent `line-height: normal` aux <select>, si
                  // bien qu'il dépassait le bouton d'à côté de 0.8 px et
                  // enflait l'en-tête d'autant.
                  className="input !h-[1.6rem] !w-auto max-w-40 !text-xs sm:max-w-56"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) rattacherMarche(Number(e.target.value));
                  }}
                  disabled={pending}
                  aria-label="Rattacher un marché existant"
                >
                  <option value="">Rattacher existant…</option>
                  {marchesDisponibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              )}
              {/* « Créer » face à « Rattacher » : deux verbes qui s'opposent,
                  l'objet étant dit par le titre de la carte. Un libellé entier
                  — « Ajouter un contrat ou marché » — poussait le menu hors de
                  l'en-tête sur un écran ordinaire. */}
              {/* `!text-xs` ramène la hauteur à 26 px — 16 de ligne, 8 de
                  retrait, 2 de bordure —, le gabarit des commandes d'en-tête de
                  la fiche d'un marché. `!px-2.5` et `!gap-1.5` resserrent ce
                  qu'une icône et un mot n'ont pas besoin d'étaler. Le menu
                  voisin reçoit le même `!text-xs` : posés sur la même ligne, ils
                  doivent tomber à la même hauteur. */}
              {modeEdition ? (
                <button
                  type="button"
                  className="btn-secondary !gap-1.5 !px-2.5 !text-xs"
                  onClick={() =>
                    setMarcheForm((f) => (f?.mode === "creation" ? null : { mode: "creation" }))
                  }
                >
                  {marcheForm?.mode === "creation" ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {marcheForm?.mode === "creation" ? "Fermer" : "Créer"}
                </button>
              ) : null}
            </>
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
            editeurDuLogicielId={editeurDuLogicielId}
            pending={pending}
            onSubmit={soumettreMarche}
            onCancel={() => setMarcheForm(null)}
            refForm={formMarcheRef}
          />
        ) : null}

        {contrats.length === 0 ? (
          <EmptyState>
            {mentionForm !== null ? (
              /* La saisie prend la place du texte qu'elle remplace, comme le
                  formulaire d'un marché prend la place de sa ligne de titre.
                  Ses deux boutons sont ceux de tous les sous-formulaires de
                  l'onglet — et le « Enregistrer » global la soumet aussi. */
              <form
                className="mx-auto max-w-xl space-y-2 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    await envoyerMention();
                  });
                }}
              >
                <input
                  className="input"
                  value={mentionForm}
                  onChange={(e) => setMentionForm(e.target.value)}
                  maxLength={200}
                  disabled={pending}
                  // biome-ignore lint/a11y/noAutofocus: la saisie vient d'être demandée d'un clic sur le crayon.
                  autoFocus
                  aria-label="Libellé affiché en l'absence de contrat"
                  placeholder="Contrat géré par le CCAS, par exemple"
                />
                <p className="text-xs">
                  Ce texte remplace le message standard sur cette fiche tant qu'aucun contrat n'y
                  est rattaché. Laissez-le vide pour retrouver le message standard.
                </p>
                <div className="flex gap-3">
                  <button type="submit" disabled={pending} className="btn-primary">
                    {pending ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button
                    type="button"
                    className="btn-warn"
                    disabled={pending}
                    onClick={() => setMentionForm(null)}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <span className="inline-flex flex-wrap items-center justify-center gap-1">
                <span>{mentionSansContrat || TEXTE_SANS_CONTRAT}</span>
                {/* Le crayon ne paraît que sous le mode modification : ce
                    libellé est un champ de la fiche comme les autres. */}
                {fige ? null : (
                  <button
                    type="button"
                    className="btn-ghost !p-1.5"
                    title="Modifier ce libellé"
                    disabled={pending}
                    onClick={() => setMentionForm(mentionSansContrat)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            )}
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
                    editeurDuLogicielId={editeurDuLogicielId}
                    pending={pending}
                    onSubmit={soumettreMarche}
                    onCancel={() => setMarcheForm(null)}
                    refForm={formMarcheRef}
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

                        Référence 6.25rem (100 px) et fournisseur 15.625rem
                        (250 px). Cette dernière portait 260 px, largeur mesurée
                        du plus long couple de montants — « Mnt annuel :
                        999 999,99 € · Maxi : 999 999,99 € », 258,14 px — qui se
                        tronque donc désormais dans ce cas extrême, son `title`
                        le donnant au survol. Tout ce qui n'est pas pris par ces
                        deux colonnes revient au libellé, seul à s'étirer — les
                        élargir le raccourcit d'autant. */}
                      <span className="grid grid-cols-[minmax(3rem,6.25rem)_minmax(8rem,1fr)_minmax(6rem,15.625rem)] items-baseline gap-2 font-semibold text-strong">
                        {/* Sans référence, la nature MONTE ici : la colonne
                          resterait vide, et un marché non numéroté se désigne
                          alors par ce qu'il est. Elle ne se dit qu'une fois —
                          la rangée du dessous se tait dans ce cas.

                          Ce qui NOMME le marché mène à sa fiche : la référence
                          ici, le libellé à côté. Le crayon voisin ouvre le
                          formulaire sur place, pour une correction rapide ;
                          suivre le nom, c'est vouloir le marché entier — ses
                          logiciels couverts, ses pièces, sa corbeille. */}
                        <Link
                          href={`/contrats/${c.id}`}
                          className="truncate hover:text-accent"
                          title={c.referenceMarche || natureDe(c)}
                        >
                          {c.referenceMarche || natureDe(c)}
                        </Link>
                        {/* Le badge accompagne le LIBELLÉ, pas la période : c'est
                          le marché qui est terminé, pas ses dates. `shrink-0`
                          le préserve — le libellé se coupe avant lui. */}
                        <span className="flex min-w-0 items-baseline gap-2">
                          <Link
                            href={`/contrats/${c.id}`}
                            className="truncate hover:text-accent"
                            title={c.libelle || undefined}
                          >
                            {c.libelle || (c.referenceMarche ? "" : "sans libellé")}
                          </Link>
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

                          Ce que le marché NOMME, et rien d'autre. L'écran
                          affichait l'éditeur du logiciel à la place d'un
                          fournisseur vide : un acte de 2019 se serait donc mis à
                          désigner le repreneur du jour où le logiciel change de
                          main. Un marché est signé avec la société du moment ;
                          il ne suit pas l'éditeur. Sans nom enregistré, la
                          colonne se tait. */}
                        {c.fournisseurId ? (
                          // Même encre que la référence et le libellé, ses
                          // voisins de rang : les trois NOMMENT le marché, et
                          // seul le fournisseur s'affadissait — sa colonne se
                          // lisait comme une mention accessoire alors qu'elle
                          // dit avec qui l'on s'est engagé.
                          // `text-right` : la colonne borde les actions du
                          // marché, et son contenu vient s'y adosser — le
                          // montant de la rangée du dessous fait de même.
                          <Link
                            href={`/editeurs/${c.fournisseurId}`}
                            className="truncate text-right hover:text-accent"
                            title={c.fournisseurNom ?? undefined}
                          >
                            {c.fournisseurNom}
                          </Link>
                        ) : (
                          // La colonne reste, vide, pour que les deux rangées
                          // gardent le même gabarit.
                          <span />
                        )}
                      </span>
                      {/* Deuxième rangée, MÊME gabarit de colonnes que le titre :
                        la date de fin tombe ainsi sous le libellé et le montant
                        sous le fournisseur, ce qu'ils qualifient chacun. Les
                        deux se taisent quand ils ne sont pas renseignés — un
                        marché sans terme saisi n'a pas à afficher un tiret. */}
                      <span className="grid grid-cols-[minmax(3rem,6.25rem)_minmax(8rem,1fr)_minmax(6rem,15.625rem)] items-baseline gap-2 text-xs text-faint">
                        {/* Sous la référence, ce que l'acte EST — le compte des
                          pièces a rejoint l'en-tête du tableau qui les porte,
                          où il désigne ce qu'on lit. Vide quand il n'y a pas de
                          référence : la nature est alors montée à sa place, un
                          rang plus haut, et se répéterait ici. */}
                        <span>{c.referenceMarche ? natureDe(c) : ""}</span>
                        {/* `title` : la colonne est étroite et l'engagement
                          allonge la ligne — tronquée, elle reste lisible au
                          survol. */}
                        <span className="truncate" title={periodeEtEngagement(c) || undefined}>
                          {periodeEtEngagement(c)}
                        </span>
                        {/* « Mnt annuel » abrégé : les deux montants partagent
                          une colonne qui contenait déjà tout juste le premier.
                          Le plafond ne s'affiche que s'il est saisi — tous les
                          actes n'en fixent pas. `title` porte les libellés
                          entiers, la colonne tronquant au besoin. */}
                        <span
                          className="truncate text-right tabular-nums"
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
                    {fige ? null : (
                      <span className="flex shrink-0 items-center gap-1">
                        {/* Ne restent ici que les gestes qui portent sur le
                          MARCHÉ lui-même : le modifier, le détacher.
                          « + Pièce » est descendu au-dessus des pièces, où il
                          porte. */}
                        <button
                          type="button"
                          className="btn-ghost !p-2"
                          title="Modifier le contrat"
                          disabled={pending}
                          onClick={() => setMarcheForm({ mode: "edition", row: c })}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {/* Un maillon coupé, PAS une corbeille : ce geste retire
                          le marché de cette fiche, il ne l'efface pas. La
                          corbeille est restée sur la fiche du marché, qui seule
                          montre tous les logiciels qu'on détruirait avec. */}
                        <button
                          type="button"
                          className="btn-ghost !p-2 hover:!text-danger"
                          title="Retirer ce marché du logiciel (le marché n'est pas supprimé)"
                          disabled={pending}
                          onClick={() => detacherMarche(c)}
                        >
                          <Unlink className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </header>
                )}

                {/* Pas de `pt` ici : l'air au-dessus de la bande « n pièces »
                    est posé par la bande elle-même (`my-1.5`), au même endroit
                    que celui du dessous. Les deux ne peuvent donc plus diverger
                    — c'est ce qui était arrivé, 16 px en haut contre 6 en bas.
                    Les trois autres côtés gardent la marge du bloc. */}
                <div className="px-4 pb-4">
                  {/* En-tête du bloc : ce qu'on va lire à gauche, le geste qui
                      l'alimente à droite. « + Pièce » vivait dans l'en-tête du
                      marché, entre des boutons qui portent sur le marché
                      lui-même — modifier, détacher ; il est descendu au-dessus
                      des pièces, sur lesquelles il porte vraiment. La ligne
                      reste quand il n'y en a aucune : c'est le seul endroit
                      d'où en ajouter une première. */}
                  {/* `items-end` : le compte des pièces s'aligne par le BAS sur
                      le bouton, pas par le milieu. C'est ce qui se voit — deux
                      objets de hauteurs très différentes, 15 px de texte contre
                      30 px de bouton, dont seul le pied commun fait une ligne.
                      */}
                  <div className="my-1.5 flex items-end justify-between gap-3">
                    {/* « 3 Pièces » : ni les capitales d'un en-tête de colonne,
                      ni le tout-minuscule d'une phrase — le compte se lit comme
                      un intitulé, d'où la seule majuscule initiale du mot.
                      `tracking-wide` est parti avec les capitales, dont il
                      espaçait les lettres. */}
                    <span className="text-xs font-semibold text-faint">
                      {c.pieces.length === 0
                        ? ""
                        : `${c.pieces.length} Pièce${c.pieces.length > 1 ? "s" : ""}`}
                    </span>
                    {fige ? null : (
                      <button
                        type="button"
                        className="btn-secondary !gap-1.5 !px-2.5 !text-xs"
                        disabled={pending}
                        onClick={() =>
                          setPieceForm((f) =>
                            f?.contratId === c.id && f.row === null
                              ? null
                              : { contratId: c.id, row: null },
                          )
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Pièce
                      </button>
                    )}
                  </div>

                  {/* Ajout : le formulaire se pose sous l'en-tête, donc sous le
                      bouton qui vient de l'ouvrir, et au-dessus des pièces
                      existantes. En MODIFICATION il prend la place de la pièce
                      concernée, plus bas. */}
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
                      refForm={formPieceRef}
                    />
                  ) : null}

                  {c.pieces.length === 0 ? (
                    <p className="text-sm text-faint">Aucune pièce pour ce contrat.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        {/* La largeur de la colonne d'actions vivait dans le
                            `<th className="w-20">` de l'en-tête, disparu avec
                            lui : la cellule s'étirait alors sur tout ce qui
                            restait, et les deux icônes flottaient à gauche d'un
                            vide. Un `colgroup` la porte désormais. */}
                        {fige ? null : (
                          <colgroup>
                            <col />
                            <col className="w-20" />
                          </colgroup>
                        )}
                        <tbody>
                          {c.pieces.map((l) =>
                            pieceForm?.row?.id === l.id ? (
                              <tr key={l.id}>
                                <td colSpan={fige ? 1 : 2} className="!py-2 !pr-0">
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
                                    refForm={formPieceRef}
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
                                      readOnly={fige}
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
                                {fige ? null : (
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
  editeurDuLogicielId,
  pending,
  onSubmit,
  onCancel,
  refForm,
  className = "mb-5 rounded-xl border border-sub bg-inset p-4",
}: {
  row: ContratRow | null;
  editeurs: Array<{ id: number; nom: string }>;
  /** Fournisseur proposé d'office à la création — inscrit, jamais déduit. */
  editeurDuLogicielId: number | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  /** Poignée sur le <form>, pour le « Enregistrer » global de la fiche. */
  refForm?: React.RefObject<HTMLFormElement | null>;
  /**
   * Habillage : la marge basse sert au formulaire de CRÉATION, posé au-dessus
   * de la liste. En modification, le formulaire prend la place d'un marché dans
   * une liste déjà espacée (`space-y-5`) — la marge y ferait double emploi.
   */
  className?: string;
}) {
  return (
    <form ref={refForm} onSubmit={onSubmit} className={className}>
      {/* Les champs viennent du module partagé avec la fiche du marché : mêmes
          libellés, mêmes aides, même grille.

          À la CRÉATION, le fournisseur s'ouvre sur l'éditeur du logiciel : c'est
          avec lui qu'on signe neuf fois sur dix, et la valeur est INSCRITE, non
          déduite — un marché nomme la société du jour de sa signature, et ne
          doit pas suivre l'éditeur si le logiciel change de main plus tard. En
          MODIFICATION, la valeur enregistrée est reprise telle quelle : on ne
          réécrit pas un acte passé en rouvrant son formulaire. */}
      <ChampsMarche
        values={
          row ??
          (editeurDuLogicielId === null
            ? undefined
            : { ...MARCHE_VIDE, fournisseurId: String(editeurDuLogicielId) })
        }
        editeurs={editeurs}
        disabled={pending}
      />
      <div className="mt-3 flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : row ? "Enregistrer" : "Ajouter le contrat"}
        </button>
        <button type="button" className="btn-warn" disabled={pending} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
