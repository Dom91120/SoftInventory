"use client";

import type { LucideIcon } from "lucide-react";
import {
  Check,
  Download,
  FileArchive,
  // Aliasé : `File` masquerait le type DOM du même nom, utilisé par upload().
  File as FileGenerique,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Pencil,
  Presentation,
  SquarePen,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteDocumentAction,
  renameDocumentAction,
  updateDocumentCategorieAction,
} from "@/app/(app)/documents/actions";
import { DETAIL_FICHIER_DEFINITIF, useConfirmation } from "@/components/confirmation";
import { Card, EmptyState } from "@/components/ui";
import { extensionDe } from "@/lib/documents-regles";

export type DocumentRow = {
  id: number;
  nomOriginal: string;
  /**
   * Identifiant de la catégorie. Reste nullable pour les documents hérités,
   * mais l'application ne produit plus ce cas : aucune liste n'offre d'option
   * vide, « Autre » servant de fourre-tout.
   */
  categorieId: number | null;
  categorie: string | null;
  taille: number;
  deposeParLabel: string;
  createdAt: string; // déjà formatée côté serveur
};

export type CategorieOption = { id: number; label: string };

/**
 * Catégorie proposée d'office au dépôt — le cas courant de ce panneau, qui
 * reçoit surtout des guides et de la documentation. Rapprochée par LIBELLÉ et
 * non par id : le référentiel est saisi par l'admin, l'entrée peut manquer.
 * La fiche éditeur en propose une autre (voir `categorieParDefaut`).
 */
const CATEGORIE_PAR_DEFAUT = "Documentation technique";

/**
 * Icône par famille de fichier. Le type MIME n'est pas conservé en base : c'est
 * l'extension du nom d'origine qui fait foi. Les clés couvrent exactement
 * TYPES_ADMIS (documents-regles) — une extension ajoutée là-bas et pas ici
 * retombe sur l'icône générique, sans casse.
 */
const ICONES: Record<string, LucideIcon> = {
  pdf: FileText,
  doc: FileType,
  docx: FileType,
  odt: FileType,
  txt: FileType,
  md: FileType,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ods: FileSpreadsheet,
  csv: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  odp: Presentation,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  zip: FileArchive,
};

export function iconeDe(nomOriginal: string): LucideIcon {
  return ICONES[extensionDe(nomOriginal)] ?? FileGenerique;
}

export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Une pièce jointe affichée DANS une ligne de tableau : nom cliquable et
 * téléchargement, puis catégorie, taille, déposant et date en dessous.
 *
 * Partagée par les onglets Contrats et Devis, où les pièces se lisent dans la
 * ligne de leur contrat ou de leur devis plutôt que dans un panneau séparé. Le
 * dépôt et le retrait n'y figurent pas : ils passent par le formulaire de la
 * ligne et par sa corbeille, qui emporte tout.
 */
export function LigneDocument({
  document,
  categories,
  readOnly,
  categorieModifiable = true,
  dateLigne,
  onErreur,
}: {
  document: DocumentRow;
  categories: CategorieOption[];
  readOnly: boolean;
  /**
   * Faux quand le formulaire de la ligne porte déjà le choix de la catégorie
   * (onglet Contrats) : elle s'y modifie au crayon, et la figer ici évite deux
   * commandes concurrentes pour la même valeur. L'onglet Devis, dont le
   * formulaire pose « Devis » d'office sans le proposer, la garde modifiable —
   * c'est son seul point d'entrée.
   */
  categorieModifiable?: boolean;
  /**
   * Date propre à la ligne qui porte ce fichier (« JJ/MM/AAAA », déjà formatée).
   * Fournie, elle REMPLACE « déposé par … · date de dépôt » : sur une pièce de
   * marché, ce qui compte est la date du document — sa signature, sa
   * notification — pas le moment où quelqu'un l'a téléversé dans l'outil.
   */
  dateLigne?: string | null;
  /**
   * Remontée d'erreur du changement de catégorie. FACULTATIVE : la ligne se
   * rend aussi depuis un composant serveur (fiche d'un marché), qui ne peut pas
   * passer de fonction. Sans elle, la catégorie n'est pas modifiable — et de
   * fait, les deux appels qui s'en servent vivent dans le select, qui n'est
   * rendu ni en lecture seule ni quand `categorieModifiable` est faux.
   */
  onErreur?: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icone = iconeDe(document.nomOriginal);

  // Deux raisons de ne pas offrir la liste, un seul rendu : le lecteur ne
  // modifie rien, et l'onglet Contrats réserve la catégorie à son crayon.
  const categorieFigee = readOnly || !categorieModifiable;

  function changerCategorie(valeur: string) {
    onErreur?.(null);
    startTransition(async () => {
      const res = await updateDocumentCategorieAction(
        document.id,
        valeur === "" ? null : Number(valeur),
      );
      if (!res.ok) onErreur?.(res.error);
      // Rafraîchi dans tous les cas : en cas d'échec, la liste revient sur la
      // valeur réellement enregistrée plutôt que d'afficher un changement qui
      // n'a pas eu lieu.
      router.refresh();
    });
  }

  // Icône centrée sur le bloc de deux lignes (items-center), gap-3 pour la
  // décoller du texte, mt-0.5 entre le nom et la ligne d'informations.
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Icone className="h-4 w-4 shrink-0 text-faint" />
      <span className="min-w-0">
        {/* Un raccourci accolé au nom, comme partout ailleurs dans
            l'application : 14 px, gris estompé virant à l'indigo au survol. Il
            portait auparavant le gabarit d'un bouton — fond au survol, 16 px
            d'icône, 6 px de marge —, ce qui commandait la hauteur de la ligne :
            28 px contre 20 pour le texte, et il fallait annuler cette marge à
            coups de `-my-1.5`. Une icône nue n'a plus ce défaut. */}
        <span className="flex items-center gap-1.5">
          <a
            href={`/api/documents/download?id=${document.id}&inline=1`}
            target="_blank"
            rel="noreferrer noopener"
            title={`Ouvrir ${document.nomOriginal}`}
            className="min-w-0 truncate font-medium text-strong hover:text-accent"
          >
            {document.nomOriginal}
          </a>
          <a
            href={`/api/documents/download?id=${document.id}`}
            title={`Télécharger ${document.nomOriginal}`}
            aria-label={`Télécharger ${document.nomOriginal}`}
            className="shrink-0 text-faint transition hover:text-accent"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-faint">
          {categorieFigee ? null : (
            <select
              className="select-inline"
              aria-label={`Catégorie de ${document.nomOriginal}`}
              value={document.categorieId === null ? "" : String(document.categorieId)}
              disabled={pending}
              onChange={(e) => changerCategorie(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          <span>
            {[
              // Figée, la catégorie n'est plus qu'une information parmi les
              // autres : elle rejoint leur énumération plutôt que de vivre dans
              // son propre bloc, et le « · » qui les sépare la sépare aussi.
              // Modifiable, le select reste à part — on ne ponctue pas une
              // commande.
              //
              // Rien à écrire quand elle manque : « sans catégorie » n'est plus
              // un état que l'application propose (« Autre » tient ce rôle), le
              // `filter` en dessous l'écarte donc sans laisser de séparateur.
              categorieFigee ? document.categorie : null,
              tailleLisible(document.taille),
              // `dateLigne === undefined` : l'appelant ne gère pas de date
              // propre, on garde la traçabilité du dépôt. Fournie mais vide,
              // elle l'efface sans la remplacer — la pièce n'est pas datée.
              ...(dateLigne === undefined
                ? [
                    document.deposeParLabel && `déposé par ${document.deposeParLabel}`,
                    document.createdAt,
                  ]
                : [dateLigne]),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Pièces jointes d'un logiciel ou d'un éditeur : dépôt (admin), liste,
 * téléchargement (tous), suppression (admin). Le dépôt passe par la route
 * /api/documents/upload (flux binaire), pas par une server action.
 */
export function DocumentsPanel({
  parent,
  documents,
  categories,
  readOnly,
  titre = "Documents",
  categorieParDefaut = CATEGORIE_PAR_DEFAUT,
}: {
  parent:
    | { logicielId: number }
    | { editeurId: number }
    | { contratId: number }
    | { devisId: number }
    | { certificatId: number };
  documents: DocumentRow[];
  categories: CategorieOption[];
  readOnly: boolean;
  /** Titre de la carte — précisé quand le panneau vise une ligne de contrat. */
  titre?: string;
  /**
   * Libellé de la catégorie présélectionnée au dépôt, quand ce panneau reçoit
   * autre chose que de la documentation technique — la fiche éditeur, qui
   * collecte surtout des présentations commerciales.
   */
  categorieParDefaut?: string;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le dépôt part classé plutôt que sans catégorie : l'application ne produit
  // plus ce cas. Repli sur la première entrée du référentiel si l'admin a
  // renommé ou supprimé l'entrée par défaut.
  const [categorieId, setCategorieId] = useState(() => {
    const defaut = categories.find((c) => c.label === categorieParDefaut)?.id ?? categories[0]?.id;
    return defaut === undefined ? "" : String(defaut);
  });
  // Document en cours de renommage : { id, valeur saisie }.
  const [renommage, setRenommage] = useState<{ id: number; valeur: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Interrupteur d'écriture, ÉTEINT d'office — celui des mises en concurrence.
   * Cette carte n'a rien à enregistrer : déposer, renommer, reclasser ou
   * supprimer s'appliquent au clic, et la corbeille emporte le fichier du
   * disque. On vient ici ouvrir une pièce bien plus souvent qu'en changer une.
   */
  const [modeEdition, setModeEdition] = useState(false);
  /** Vrai quand rien ne doit pouvoir être touché — lecteur, ou crayon éteint. */
  const fige = readOnly || !modeEdition;

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if ("logicielId" in parent) form.set("logicielId", String(parent.logicielId));
      else if ("editeurId" in parent) form.set("editeurId", String(parent.editeurId));
      else if ("contratId" in parent) form.set("contratId", String(parent.contratId));
      else if ("certificatId" in parent) form.set("certificatId", String(parent.certificatId));
      else form.set("devisId", String(parent.devisId));
      if (categorieId) form.set("categorieId", categorieId);
      const r = await fetch("/api/documents/upload", { method: "POST", body: form });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(j.error ?? "Le dépôt a échoué. Réessayez.");
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Le dépôt a échoué (réseau). Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  async function supprimer(doc: DocumentRow) {
    const ok = await confirmer({
      question: `Supprimer le document « ${doc.nomOriginal} » ?`,
      detail: DETAIL_FICHIER_DEFINITIF,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDocumentAction(doc.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function renommer() {
    if (!renommage) return;
    const { id, valeur } = renommage;
    setError(null);
    startTransition(async () => {
      const res = await renameDocumentAction(id, valeur);
      if (!res.ok) {
        setError(res.error);
        return; // le champ reste ouvert : la saisie n'est pas perdue
      }
      setRenommage(null);
      router.refresh();
    });
  }

  function changerCategorie(doc: DocumentRow, valeur: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateDocumentCategorieAction(
        doc.id,
        valeur === "" ? null : Number(valeur),
      );
      if (!res.ok) setError(res.error);
      // `router.refresh()` dans tous les cas : en cas d'échec, il remet le
      // select sur la valeur réellement enregistrée plutôt que de laisser
      // l'écran afficher un changement qui n'a pas eu lieu.
      router.refresh();
    });
  }

  return (
    <Card
      title={titre}
      // La mention des formats accompagne le DÉPÔT : elle paraît avec lui, une
      // fois le crayon allumé, et se tait quand il n'y a rien à déposer.
      hint={fige ? undefined : "PDF, Office, OpenDocument, images, txt/csv/zip — 25 Mo max."}
      // Le dépôt monte dans l'en-tête, comme les commandes des autres cartes :
      // il porte sur la carte entière et n'a pas à s'intercaler entre le titre
      // et la liste, où il repoussait les documents d'une rangée.
      actions={
        readOnly ? undefined : (
          <>
            {/* Le menu et le bouton de dépôt ne paraissent qu'une fois le droit
                donné : offerts sous le crayon éteint, ils auraient permis de
                déposer un fichier dans une carte qui se dit en lecture. */}
            {modeEdition ? (
              <>
                <select
                  // `field-sizing: content` : un <select> en largeur `auto` se règle
                  // sur sa PLUS LONGUE option — ici « Présentation commerciale » —
                  // et retient cette place même quand il affiche « Autre ». Il prend
                  // désormais la largeur de ce qu'il montre. Le plafond garde
                  // l'en-tête lisible sur un libellé long.
                  //
                  // Hauteur explicite : les navigateurs imposent `line-height:
                  // normal` aux <select>, qui dépasserait sinon le bouton voisin.
                  className="input !h-[1.6rem] !w-auto max-w-40 !text-xs [field-sizing:content] sm:max-w-56"
                  value={categorieId}
                  onChange={(e) => setCategorieId(e.target.value)}
                  disabled={uploading}
                  aria-label="Catégorie du document"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                />
                {/* Réduit à sa flèche, comme l'export des listes : l'icône de dépôt
                se passe de légende, et le libellé entier reste au survol et
                pour les lecteurs d'écran. L'infobulle NOMME le geste avant de
                détailler les formats — sans texte, elle est le seul endroit où
                l'on apprend ce que fait le bouton. */}
                <button
                  type="button"
                  // Hauteur explicite, comme le menu voisin : privé de son texte, le
                  // bouton n'a plus qu'une icône de 14 px pour se tenir et tombait
                  // 2 px plus bas que lui.
                  className="btn-secondary !h-[1.6rem] !px-2 !py-1 !text-xs"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  title={
                    uploading
                      ? "Dépôt en cours…"
                      : "Déposer un fichier — PDF, Office, OpenDocument, images, txt/csv/zip, 25 Mo max."
                  }
                  aria-label={uploading ? "Dépôt en cours" : "Déposer un fichier"}
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                // Éteindre referme le renommage en cours : son champ resterait
                // seul, sans la coche qui le valide.
                if (modeEdition) setRenommage(null);
                setModeEdition(!modeEdition);
              }}
              disabled={uploading || pending}
              aria-pressed={modeEdition}
              title={modeEdition ? "Fermer la modification" : "Modifier les documents"}
              aria-label={modeEdition ? "Fermer la modification" : "Modifier les documents"}
              className={`btn-ghost !p-2 ${modeEdition ? "!text-accent" : "hover:!text-accent"}`}
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </>
        )
      }
    >
      {error ? <p className="alert-error mb-3">{error}</p> : null}

      {documents.length === 0 ? (
        <EmptyState>Aucun document (guides, contrats, délibérations, arrêtés…).</EmptyState>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {documents.map((d) => {
            const Icone = iconeDe(d.nomOriginal);
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <Icone className="h-4 w-4 shrink-0 text-faint" />
                  <span className="min-w-0">
                    {renommage?.id === d.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          // biome-ignore lint/a11y/noAutofocus: le champ vient d'être ouvert par un clic délibéré sur « Renommer ».
                          autoFocus
                          className="input !py-1 !text-sm"
                          aria-label={`Nouveau nom de ${d.nomOriginal}`}
                          value={renommage.valeur}
                          disabled={pending}
                          onChange={(e) => setRenommage({ id: d.id, valeur: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renommer();
                            if (e.key === "Escape") setRenommage(null);
                          }}
                        />
                        <button
                          type="button"
                          className="btn-ghost !p-2"
                          title="Enregistrer le nom"
                          disabled={pending}
                          onClick={renommer}
                          style={{ color: "var(--color-ok)" }}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost !p-2"
                          title="Annuler"
                          disabled={pending}
                          onClick={() => setRenommage(null)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      // Les deux gestes que porte le nom vivent ensemble : le
                      // NOM ouvre le document dans un onglet, la flèche accolée
                      // l'enregistre. Elle était au bout de la ligne, à côté des
                      // commandes d'écriture, dont elle ne relève pas — et qui
                      // disparaissent maintenant sous le crayon éteint, la
                      // laissant seule, loin de ce qu'elle télécharge.
                      <span className="flex min-w-0 items-center gap-1.5">
                        <a
                          // Les formats que le navigateur ne sait pas afficher
                          // retombent d'eux-mêmes sur le téléchargement, côté
                          // serveur.
                          href={`/api/documents/download?id=${d.id}&inline=1`}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={`Ouvrir ${d.nomOriginal}`}
                          className="truncate font-medium text-strong hover:text-accent"
                        >
                          {d.nomOriginal}
                        </a>
                        <a
                          href={`/api/documents/download?id=${d.id}`}
                          title={`Télécharger ${d.nomOriginal}`}
                          aria-label={`Télécharger ${d.nomOriginal}`}
                          className="shrink-0 text-faint transition hover:text-accent"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </span>
                    )}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-faint">
                      {fige ? (
                        d.categorie ? (
                          <span>{d.categorie}</span>
                        ) : null
                      ) : (
                        // Catégorie modifiable en place : les imports en masse la
                        // déduisent du nom du fichier et se trompent parfois.
                        <select
                          className="select-inline"
                          aria-label={`Catégorie de ${d.nomOriginal}`}
                          value={d.categorieId === null ? "" : String(d.categorieId)}
                          disabled={pending}
                          onChange={(e) => changerCategorie(d, e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <span>
                        {[
                          tailleLisible(d.taille),
                          d.deposeParLabel && `déposé par ${d.deposeParLabel}`,
                          d.createdAt,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {fige ? null : (
                    <>
                      <button
                        type="button"
                        className="btn-ghost !p-2"
                        title="Renommer"
                        disabled={pending}
                        onClick={() => setRenommage({ id: d.id, valeur: d.nomOriginal })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !p-2 hover:!text-danger"
                        title="Supprimer"
                        disabled={pending}
                        onClick={() => supprimer(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
