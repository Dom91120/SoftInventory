"use client";

import { Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteDocumentAction,
  renameDocumentAction,
  updateDocumentCategorieAction,
} from "@/app/(app)/documents/actions";
import {
  createPieceContratAction,
  deletePieceContratAction,
  updatePieceContratAction,
} from "@/app/(app)/logiciels/actions";
import { DETAIL_FICHIER_DEFINITIF, useConfirmation } from "@/components/confirmation";
import type { CategorieOption, DocumentRow } from "@/components/documents-panel";
import { Field } from "@/components/ui";

/**
 * La pièce d'un marché, partagée par les DEUX écrans qui la saisissent :
 * l'onglet Contrats/Marchés d'un logiciel et la fiche du marché lui-même.
 *
 * Ce module porte ce qui est délicat — le formulaire et l'enchaînement
 * « enregistrer la pièce puis déposer son fichier ». Chaque écran garde en
 * revanche SA présentation : un tableau dans la ligne du marché d'un côté, une
 * carte de plein droit de l'autre.
 */

export type PieceContratRow = {
  id: number;
  /** Date du document (signature, notification) — AAAA-MM-JJ ou "". Sans rappel. */
  datePiece: string;
  /** Le fichier qui atteste la pièce. Un seul — d'où le null et non un tableau. */
  document: DocumentRow | null;
};

/** La pièce en cours de saisie : neuve (`row` null) ou rouverte au crayon. */
export type CiblePiece = { contratId: number; row: PieceContratRow | null };

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
 * Enregistrement et suppression d'une pièce, pour les deux écrans.
 *
 * `onErreur` reçoit les messages : chaque écran les affiche où il veut, en tête
 * de sa carte ou de son panneau.
 */
export function usePieceContrat(onErreur: (message: string | null) => void) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  /**
   * Qui attend le résultat d'une soumission déclenchée PAR PROGRAMME — le
   * « Enregistrer » de la fiche, qui soumet aussi la pièce en cours de saisie.
   * `soumettre` le prévient en terminant ; nul le reste du temps.
   */
  const attente = useRef<((ok: boolean) => void) | null>(null);

  /**
   * Soumet le formulaire de pièce COMME le ferait son bouton — `requestSubmit`
   * passe par la validation native puis par `onSubmit`, seul détenteur du
   * fichier choisi — et attend le verdict. Pour le « Enregistrer » global de la
   * fiche : la pièce qu'on remplissait fait partie de ce qu'on enregistre.
   */
  function soumettreViaFormulaire(form: HTMLFormElement): Promise<boolean> {
    if (!form.reportValidity()) return Promise.resolve(false);
    return new Promise((resoudre) => {
      attente.current = resoudre;
      form.requestSubmit();
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
  function soumettre(
    e: React.FormEvent<HTMLFormElement>,
    fichier: File | null,
    cible: CiblePiece,
    onFini: () => void,
  ) {
    e.preventDefault();
    onErreur(null);
    const form = new FormData(e.currentTarget);
    const brut = String(form.get("categorieId") ?? "");
    const categorieId = brut === "" ? null : Number(brut);
    // Chaque issue prévient l'éventuel « Enregistrer » global qui attend. Les
    // demi-résultats (« pièce enregistrée, mais… ») comptent comme des échecs :
    // le mode doit rester ouvert sur le message, pas se refermer dessus.
    const conclure = (ok: boolean) => {
      attente.current?.(ok);
      attente.current = null;
    };
    startTransition(async () => {
      const res = cible.row
        ? await updatePieceContratAction(cible.row.id, form)
        : await createPieceContratAction(cible.contratId, form);
      if (!res.ok) {
        onErreur(res.error);
        conclure(false);
        return;
      }
      const pieceId = cible.row?.id ?? res.id;
      if (fichier && pieceId !== undefined) {
        if (cible.row?.document) {
          const retrait = await deleteDocumentAction(cible.row.document.id);
          if (!retrait.ok) {
            // La pièce est enregistrée, le fichier non : on le dit plutôt que de
            // refermer le formulaire sur un demi-résultat.
            onErreur(
              `Pièce enregistrée, mais le fichier n'a pas pu être remplacé : ${retrait.error}`,
            );
            router.refresh();
            conclure(false);
            return;
          }
        }
        const echec = await deposerPiece(pieceId, fichier, categorieId);
        if (echec) {
          onErreur(`Pièce enregistrée, mais le dépôt a échoué : ${echec}`);
          router.refresh();
          conclure(false);
          return;
        }
      } else if (cible.row?.document) {
        // Pas de nouveau fichier : le nom et la catégorie saisis s'appliquent
        // au document déjà rattaché. Comparaisons utiles — sans elles, chaque
        // enregistrement rejouerait des écritures inutiles.
        const nomVoulu = String(form.get("nomFichier") ?? "").trim();
        if (nomVoulu !== "" && nomVoulu !== cible.row.document.nomOriginal) {
          const ren = await renameDocumentAction(cible.row.document.id, nomVoulu);
          if (!ren.ok) {
            onErreur(`Pièce enregistrée, mais le fichier n'a pas pu être renommé : ${ren.error}`);
            router.refresh();
            conclure(false);
            return;
          }
        }
        if (categorieId !== cible.row.document.categorieId) {
          const maj = await updateDocumentCategorieAction(cible.row.document.id, categorieId);
          if (!maj.ok) {
            onErreur(
              `Pièce enregistrée, mais la catégorie du fichier n'a pas suivi : ${maj.error}`,
            );
            router.refresh();
            conclure(false);
            return;
          }
        }
      }
      onFini();
      router.refresh();
      conclure(true);
    });
  }

  /** Supprime la pièce ET son fichier, après confirmation. */
  async function supprimer(l: PieceContratRow, enDateFr: (iso: string) => string) {
    // Le type nommait la pièce dans cette question ; à sa place, ce qui la
    // distingue encore de ses voisines — son fichier, sinon sa date.
    const nom = l.document?.nomOriginal ?? (l.datePiece ? enDateFr(l.datePiece) : "");
    const quoi = nom ? `la pièce « ${nom} »` : "cette pièce";
    const ok = await confirmer({
      question: `Supprimer ${quoi} ?`,
      detail: l.document ? DETAIL_FICHIER_DEFINITIF : undefined,
    });
    if (!ok) return;
    onErreur(null);
    startTransition(async () => {
      const res = await deletePieceContratAction(l.id);
      if (!res.ok) onErreur(res.error);
      else router.refresh();
    });
  }

  return { pending, soumettre, soumettreViaFormulaire, supprimer };
}

/**
 * La pièce : son fichier, la catégorie de ce fichier, sa date. Le fichier est
 * retenu en mémoire jusqu'à la validation — avant elle, il n'existe aucune pièce
 * à laquelle le rattacher.
 *
 * La catégorie ne vit pas sur la pièce mais sur son document : sans fichier,
 * elle n'a rien à qualifier et ne sera appliquée qu'au dépôt.
 */
export function FormulairePiece({
  row,
  categories,
  categorieParDefautId,
  pending,
  onSubmit,
  onCancel,
  refForm,
  className = "mb-3 rounded-xl border border-sub bg-inset p-4",
}: {
  row: PieceContratRow | null;
  categories: CategorieOption[];
  /** « Contrat » du référentiel ; null s'il a été renommé ou supprimé. */
  categorieParDefautId: number | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, fichier: File | null) => void;
  onCancel: () => void;
  /**
   * Poignée sur le <form>, pour qui doit le soumettre PAR PROGRAMME — le
   * « Enregistrer » de la fiche, via `soumettreViaFormulaire` : le fichier
   * choisi vit ici, seul `onSubmit` sait le joindre.
   */
  refForm?: React.RefObject<HTMLFormElement | null>;
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
    <form ref={refForm} onSubmit={(e) => onSubmit(e, fichier)} className={className}>
      <div className="flex flex-wrap items-start gap-4">
        {/* Renommage du fichier DÉJÀ déposé — donc seulement au crayon, et
            caché dès qu'un remplaçant est choisi : c'est alors le nouveau
            fichier qui apportera son nom. En première position : on rouvre
            plus souvent une pièce pour corriger son nom que pour la re-déposer.
            L'action serveur conserve l'extension d'elle-même. */}
        {row?.document && !fichier ? (
          <div className="w-full sm:w-56">
            <Field
              label="Nom du fichier"
              htmlFor="nomFichier"
              hint="Renomme le fichier déposé"
            >
              <input
                id="nomFichier"
                name="nomFichier"
                type="text"
                required
                maxLength={180}
                defaultValue={row.document.nomOriginal}
                disabled={pending}
                className="input"
              />
            </Field>
          </div>
        ) : null}
        {/* `w-48` : la largeur du plus long de ses deux libellés — « Remplacer
            le fichier » se pliait en deux dans `w-44`. */}
        <div className="w-full sm:w-48">
          <Field
            label="Fichier"
            hint={
              row?.document && !fichier
                ? `Actuel : ${row.document.nomOriginal}`
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
              {/* Le verbe suit l'aide d'à côté : un fichier en place se
                  REMPLACE, il ne se dépose pas une seconde fois. */}
              {row?.document ? "Remplacer le fichier" : "Déposer un fichier"}
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
        {/* `w-36` et non `shrink-0` : sans largeur, c'est l'AIDE — la plus
            longue phrase de la rangée — qui dictait celle de la colonne, et
            l'arrivée du champ « Nom du fichier » rejetait la date à la ligne.
            Bornée au plus près du champ, l'aide se replie dessous. */}
        <div className="w-full sm:w-36">
          <Field
            label="Date de la pièce"
            htmlFor="datePiece"
            hint="Date du document"
          >
            {/* `!w-32` et non `!w-auto` : la largeur naturelle du contrôle
                (152 px) compte large — 128 px suffisent à « 12/07/2024 » et au
                calendrier, vérifié à l'écran. */}
            <input
              id="datePiece"
              name="datePiece"
              type="date"
              defaultValue={row?.datePiece ?? ""}
              disabled={pending}
              className="input !w-32"
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
            <button type="button" className="btn-warn" disabled={pending} onClick={onCancel}>
              Annuler
            </button>
          </span>
        </div>
      </div>
    </form>
  );
}
