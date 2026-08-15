"use client";

import { Check, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { ModaleSociete } from "@/components/modale-societe";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import { EDITEUR_INTERNE, LIBELLES } from "@/schemas/logiciel";
import { createLogicielAction, updateLogicielAction } from "./actions";
import { BoutonSupprimerLogiciel } from "./bouton-supprimer";

export type Option = { id: number; label: string };

export type FicheValues = {
  nom: string;
  description: string;
  editeurId: string;
  developpementInterne: boolean;
  technologieId: string;
  criticiteId: string;
  hebergement: string;
  typeSource: string;
  statut: string;
  versionInstallee: string;
  url: string;
  dateMiseEnService: string; // AAAA-MM-JJ ou ""
  authentification: string;
  authentificationForte: boolean;
  nbUtilisateurs: string;
  nbMaxUtilisateurs: string;
  referentMetier: string;
  referentTechnique: string;
};

export const FICHE_VIDE: FicheValues = {
  nom: "",
  description: "",
  editeurId: "",
  developpementInterne: false,
  technologieId: "",
  criticiteId: "",
  hebergement: "on_premise",
  typeSource: "proprietaire",
  statut: "production",
  versionInstallee: "",
  url: "",
  dateMiseEnService: "",
  authentification: "",
  authentificationForte: false,
  nbUtilisateurs: "",
  nbMaxUtilisateurs: "",
  referentMetier: "",
  referentTechnique: "",
};

function Select({
  name,
  value,
  options,
  disabled,
  aucun,
  className = "input",
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  aucun?: string;
  /** Surchargé quand la liste PARTAGE sa ligne : `.input` est en pleine largeur. */
  className?: string;
}) {
  return (
    <select name={name} id={name} defaultValue={value} disabled={disabled} className={className}>
      {aucun !== undefined ? <option value="">{aucun}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const enumOptions = (libelles: Record<string, string>) =>
  Object.entries(libelles).map(([value, label]) => ({ value, label }));

/**
 * Fiche principale d'un logiciel (onglet Synthèse). `id` absent = création
 * (redirige vers la fiche créée). `readOnly` pour le lecteur — la protection
 * réelle reste dans les server actions.
 */
export function FicheForm({
  id,
  values = FICHE_VIDE,
  editeurs,
  technologies,
  criticites,
  statuts,
  hebergements,
  nbPiecesJointes = 0,
  readOnly = false,
}: {
  id?: number;
  values?: FicheValues;
  editeurs: Option[];
  technologies: Option[];
  criticites: Option[];
  /** Statuts du référentiel : la clé est envoyée, le libellé est affiché. */
  statuts: Array<{ cle: string; label: string }>;
  /** Modes d'hébergement du référentiel : même régime que les statuts. */
  hebergements: Array<{ cle: string; label: string }>;
  /**
   * Pièces jointes qu'emporterait la suppression : celles de la fiche, de ses
   * contrats et de ses devis. Tant qu'il y en a, le bouton Supprimer reste
   * grisé — la cascade PostgreSQL effacerait les lignes `documents` sans
   * retirer les fichiers du disque. L'action serveur applique la même règle.
   */
  nbPiecesJointes?: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saisie = useSaisieEnCours();
  /** Retour à SA liste, et non à la page précédente : arrivé par une URL collée
   *  ou un rechargement, un retour d'historique ferait sortir de l'application. */
  const quitter = () => router.push("/logiciels");

  /**
   * Enregistre CE formulaire, à la demande du mode — c'est le morceau que la
   * fiche apporte au « Enregistrer » global. La validation native passe
   * d'abord : un nom vide doit se dire ici, pas en erreur serveur.
   */
  async function enregistrerFormulaire(): Promise<boolean> {
    const form = saisie.formRef.current;
    if (id === undefined || !form) return true;
    if (!form.reportValidity()) return false;
    setError(null);
    const res = await updateLogicielAction(id, new FormData(form));
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setSaved(true);
    saisie.enregistre();
    router.refresh();
    return true;
  }

  /**
   * Le verrou de la fiche n'est plus le sien : c'est LE mode « je modifie
   * cette fiche », porté par la barre d'onglets et partagé par tous les
   * panneaux — le crayon est au niveau des onglets, pas d'une carte. Le
   * formulaire s'y inscrit avec ses trois réponses : dire s'il porte une
   * saisie, la rendre, l'enregistrer.
   *
   * En CRÉATION, pas de provider : `mode` est nul et tout reste ouvert — une
   * fiche qu'on est en train de saisir n'a rien à protéger.
   */
  const mode = useInscriptionModeFiche({
    sale: () => id !== undefined && saisie.modifie,
    rendre: saisie.annuler,
    enregistrer: enregistrerFormulaire,
  });
  const ouvert = mode ? mode.actif : id === undefined;
  const dis = readOnly || pending || !ouvert;

  /**
   * `FormData` IGNORE les champs désactivés : l'empreinte relevée au premier
   * rendu, cartes verrouillées, ne vaut donc rien une fois les champs
   * réveillés. On la reprend à l'ouverture du mode — sans quoi la première
   * frappe comparerait un formulaire complet à un formulaire vide, et
   * « Enregistrer » paraîtrait de lui-même.
   */
  useEffect(() => {
    if (ouvert) saisie.enregistre();
  }, [ouvert, saisie.enregistre]);

  /**
   * « Annuler » en CRÉATION, où il veut dire quitter : la même question, pour
   * ce qui est le même geste — renoncer à ce qu'on a tapé. Elle porte
   * simplement plus lourd ici, puisque rien n'a encore été créé et qu'il n'y a
   * aucun enregistrement où revenir.
   */
  async function quitterCreation() {
    if (saisie.modifie) {
      const ok = await confirmer({
        question: "Quitter sans créer le logiciel ?",
        detail: "La saisie en cours sera perdue.",
        action: "Quitter sans créer",
      });
      if (!ok) return;
    }
    quitter();
  }

  /**
   * Annuaire tenu localement : une société créée depuis la fiche doit paraître
   * dans la liste SANS recharger la page, qui perdrait la saisie en cours.
   */
  const [annuaire, setAnnuaire] = useState(editeurs);
  const [modaleSociete, setModaleSociete] = useState(false);
  /**
   * Société à sélectionner une fois son option rendue. La liste est NON
   * CONTRÔLÉE — `defaultValue`, comme tout ce formulaire, pour que « Annuler »
   * la rende au `reset()` du DOM. On ne peut donc pas la piloter par un état :
   * on pose la valeur sur l'élément, mais après le rendu qui a ajouté l'option,
   * d'où le passage par un effet.
   */
  const [aSelectionner, setASelectionner] = useState<number | null>(null);
  useEffect(() => {
    if (aSelectionner === null) return;
    const liste = document.getElementById("editeurId");
    if (liste instanceof HTMLSelectElement) {
      liste.value = String(aSelectionner);
      // La ligne d'actions suit l'écart à l'enregistré : sans cette annonce,
      // « Enregistrer » resterait absent alors que la fiche a changé.
      saisie.surSaisie();
    }
    setASelectionner(null);
  }, [aSelectionner, saisie.surSaisie]);

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. La laisser à l'écran, c'est laisser croire, au geste
   *  suivant, qu'elle parle de celui-là. */
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  /**
   * Envoi du formulaire — bouton « Enregistrer » ou touche Entrée. Sur une
   * fiche EXISTANTE, il passe par le mode : on modifie toute la fiche, on
   * l'enregistre toute — chaque onglet qui porte une saisie enregistre la
   * sienne, et le mode se referme si tout a abouti. En CRÉATION, il crée.
   */
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    if (mode) {
      void mode.enregistrerTout();
      return;
    }
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        id === undefined ? await createLogicielAction(form) : await updateLogicielAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/logiciels/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        saisie.enregistre();
        router.refresh();
      }
    });
  }

  const refOptions = (list: Option[]) => list.map((o) => ({ value: String(o.id), label: o.label }));

  /**
   * Raccourci accolé au libellé de l'URL, comme sur la fiche éditeur : ouvrir
   * l'application depuis sa fiche, sans recopier l'adresse. Il vaut pour ce qui
   * est ENREGISTRÉ, pas pour ce qui est en train d'être tapé — le champ est non
   * contrôlé, et un lien qui suivrait la frappe mènerait à des adresses
   * incomplètes une lettre sur deux. Il paraît donc après enregistrement, et
   * disparaît si l'adresse est effacée.
   */
  const urlSaisie = values.url.trim();
  const lienApplication = urlSaisie ? (
    <a
      // Une adresse enregistrée sans protocole serait comprise comme un chemin
      // relatif et mènerait à une page de l'application.
      href={/^https?:\/\//i.test(urlSaisie) ? urlSaisie : `https://${urlSaisie}`}
      target="_blank"
      rel="noreferrer noopener"
      title={`Ouvrir ${urlSaisie}`}
      aria-label={`Ouvrir ${urlSaisie}`}
      className="shrink-0 text-faint transition hover:text-accent"
    >
      <ExternalLink className="h-3 w-3" />
    </a>
  ) : null;

  return (
    <form ref={saisie.formRef} onSubmit={submit} onChange={saisie.surSaisie} className="space-y-3">
      <Card title="Identité">
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          {/* Ce qui NOMME le logiciel sur un seul rang : comment il s'appelle,
              dans quelle version, chez qui, et où on l'ouvre. Parts inégales —
              25 / 8 / 33 / 33 — parce que ces quatre valeurs n'ont pas du tout
              la même longueur : un numéro de version tient en six caractères,
              une URL en soixante.

              `fr` et non `%` : la grille pose trois gouttières de 12 px entre
              les colonnes, et quatre pourcentages faisant 99 déborderaient
              d'autant. Les parts se partagent ce qui reste après les
              gouttières, dans le rapport demandé. */}
          <div
            className="grid items-end gap-x-3 gap-y-2 sm:col-span-2"
            style={{ gridTemplateColumns: "25fr 8fr 33fr 33fr" }}
          >
            <Field label="Nom du logiciel" htmlFor="nom" required>
              <input
                id="nom"
                name="nom"
                defaultValue={values.nom}
                required
                disabled={dis}
                className="input"
              />
            </Field>
            {/* La version accompagne le nom : « Adagio 6.2 » se dit d'un trait,
                et c'est la première chose qu'on vérifie devant une fiche. Elle
                vient de la carte Technique, où elle voisinait des choix
                d'architecture qu'on ne rouvre presque jamais. */}
            {/* La version se serre contre le nom : ensemble ils disent la même
                chose, « Adagio 6.2 ». Les 4 px qui les séparent sont ceux qui
                séparent l'éditeur de son « + », deux morceaux d'un même geste.

                Une grille n'a qu'une gouttière pour toutes ses colonnes : le
                bloc déborde donc de 8 px sur la sienne, et les récupère en
                largeur. Sa piste ne bouge pas — il n'en occupe toujours que la
                largeur nue —, donc ses voisines non plus.

                Le plancher, lui, est POSÉ : une piste `fr` ne descend pas sous
                la largeur de son libellé, et sur une fenêtre étroite « VERSION »
                cloue la sienne à 57 px, où le retrait négatif reprendrait les
                8 px qu'il vient de donner. Un plancher SEUL ne suffirait pas
                non plus : passé 840 px de rangée, la part de 8 % dépasse ces
                65 px et une largeur fixe rétrécirait le champ au lieu de
                l'élargir. */}
            <div className="-ml-2 w-[calc(100%_+_0.5rem)] min-w-[65px]">
              <Field label="Version" htmlFor="versionInstallee">
                <input
                  id="versionInstallee"
                  name="versionInstallee"
                  defaultValue={values.versionInstallee}
                  disabled={dis}
                  className="input"
                />
              </Field>
            </div>
            {/* Une seule liste pour une seule question : qui édite ce logiciel ?
                « Développement interne » y est une réponse comme une autre —
                fait maison, il n'y a pas d'éditeur à désigner. La sentinelle
                redevient le booléen `developpementInterne` côté serveur (voir
                parseFiche) ; rien n'entre dans l'annuaire des éditeurs. */}
            <Field label="Éditeur" htmlFor="editeurId">
              {/* Le « + » ouvre la fiche éditeur ENTIÈRE, sans quitter celle-ci :
                  on découvre qu'un éditeur manque au moment de le désigner, et
                  aller le créer ailleurs coûterait la saisie en cours. Même
                  geste qu'au fournisseur d'un devis, et la même modale. */}
              <span className="flex items-center gap-1">
                <Select
                  name="editeurId"
                  value={values.developpementInterne ? EDITEUR_INTERNE : values.editeurId}
                  options={[
                    { value: EDITEUR_INTERNE, label: "— développement interne —" },
                    ...refOptions(annuaire),
                  ]}
                  disabled={dis}
                  aucun="— aucun —"
                  className="input min-w-0 flex-1"
                />
                {readOnly ? null : (
                  <button
                    type="button"
                    // Carré de 29.6 px, la hauteur de la liste qu'il accompagne.
                    // Les DEUX dimensions sont posées : privé de texte, le bouton
                    // n'a plus qu'une icône de 16 px pour se tenir et retombait à
                    // 25.6 px, quatre de moins que le champ d'à côté.
                    className="btn-secondary !h-[1.85rem] !w-[1.85rem] shrink-0 !p-0"
                    title="Créer un éditeur absent de l'annuaire"
                    aria-label="Créer un éditeur absent de l'annuaire"
                    disabled={dis}
                    onClick={() => setModaleSociete(true)}
                  >
                    <span aria-hidden className="text-sm leading-none">
                      ➕
                    </span>
                  </button>
                )}
              </span>
            </Field>
            {/* Son aide passe en infobulle : sous le champ, elle aurait creusé
                le rang d'une ligne et décalé les trois voisins, `items-end`
                alignant les cellules par le bas. */}
            <Field
              label="URL de l'application"
              htmlFor="url"
              infobulle="Lien direct vers le produit quand il est accessible en mode web."
              action={lienApplication}
            >
              <input
                id="url"
                name="url"
                type="url"
                defaultValue={values.url}
                disabled={dis}
                className="input"
                placeholder="https://…"
              />
            </Field>
          </div>
          {/* Cinq champs sur un seul rang : ce qui QUALIFIE le logiciel — son
              état, son importance, sa population, qui en répond — se lit d'un
              balayage plutôt que sur deux rangs de moitiés. Le nombre
              d'utilisateurs tient de l'identité plus que du coût : on le demande
              juste après « à quel point est-il critique ? », et le plafond
              derrière lui, qui ne veut rien dire sans le réel.

              Parts très inégales — 12/15/9/9/55 — parce que les quatre
              premières portent une pastille ou deux chiffres, quand la dernière
              porte un nom de personne. `fr` et non `%`, comme au rang du
              dessus : les quatre gouttières de 12 px se prennent avant le
              partage. Sur une fenêtre étroite les parts ne tiennent qu'à peu
              près : une piste ne descend pas sous la largeur de son libellé,
              et « Utilisateurs » en impose 91 à elle seule.

              Sous-grille, la carte étant en deux colonnes : elle ne sait pas
              couper une moitié en cinq.

              `items-end` comme les contacts de la fiche éditeur : au cinquième
              de largeur, « Nombre d'utilisateurs » se replie là où « Statut »
              tient sur une ligne, et aligner les cellules par le BAS garde les
              cinq champs sur le même rang. Ce que la carte « Usage et coûts »
              s'interdit — ses aides sous la saisie décaleraient les champs —
              vaut ici : les deux précisions de ce rang sont passées en
              infobulle du libellé. */}
          <div
            className="grid items-end gap-x-3 gap-y-2 sm:col-span-2"
            style={{ gridTemplateColumns: "12fr 15fr 9fr 9fr 55fr" }}
          >
            <Field label="Statut" htmlFor="statut">
              <Select
                name="statut"
                value={values.statut}
                options={statuts.map((s) => ({ value: s.cle, label: s.label }))}
                disabled={dis}
              />
            </Field>
            <Field label="Criticité" htmlFor="criticiteId">
              <Select
                name="criticiteId"
                value={values.criticiteId}
                options={refOptions(criticites)}
                disabled={dis}
                aucun="— non évaluée —"
              />
            </Field>
            {/* Libellés courts, et l'infobulle dit le reste : au dixième de
                largeur, « Nombre d'utilisateurs » clouait sa colonne à 95 px —
                la largeur de son plus long mot — et mangeait la part du référent
                métier. « Utilisateurs » puis « Max » se lisent l'un après
                l'autre, le second n'ayant de sens que par le premier. */}
            <Field
              label="Utilisateurs"
              htmlFor="nbUtilisateurs"
              infobulle="Nombre d'utilisateurs. Vide = pas encore compté, différent de 0 utilisateur."
            >
              <input
                id="nbUtilisateurs"
                name="nbUtilisateurs"
                type="number"
                min={0}
                defaultValue={values.nbUtilisateurs}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field
              label="Max"
              htmlFor="nbMaxUtilisateurs"
              infobulle="Nombre d'utilisateurs maximum. Plafond prévu au contrat. Vide = illimité."
            >
              <input
                id="nbMaxUtilisateurs"
                name="nbMaxUtilisateurs"
                type="number"
                min={0}
                defaultValue={values.nbMaxUtilisateurs}
                disabled={dis}
                className="input"
              />
            </Field>
            {/* Le référent métier vient de « Usage et coûts » : c'est la personne
                qui répond de ce logiciel, pas une dépense. */}
            <Field label="Référent métier" htmlFor="referentMetier">
              <input
                id="referentMetier"
                name="referentMetier"
                defaultValue={values.referentMetier}
                disabled={dis}
                className="input"
              />
            </Field>
          </div>
          {/* Le descriptif ferme la carte : c'est le seul champ long, et il
              tient les deux colonnes. Seul champ libre de la fiche depuis que
              les notes l'ont rejoint — d'où le « puis » du placeholder : la
              phrase d'usage d'abord, elle part telle quelle dans l'export. */}
          <div className="sm:col-span-2">
            <Field label="Descriptif" htmlFor="description">
              <textarea
                id="description"
                name="description"
                defaultValue={values.description}
                disabled={dis}
                rows={4}
                className="input"
                placeholder="À quoi sert ce logiciel, pour qui… puis historique, particularités, points de vigilance."
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Technique">
        {/* Six champs courts en trois tiers, deux rangs pleins : la carte s'est
            allégée de la version, partie rejoindre le nom du logiciel, et de
            l'URL, partie avec l'éditeur — on ouvre l'application depuis la même
            ligne qui dit de qui elle vient —, mais elle a recueilli le référent
            technique. */}
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-3">
          <Field label="Hébergement" htmlFor="hebergement">
            <Select
              name="hebergement"
              value={values.hebergement}
              options={hebergements.map((h) => ({ value: h.cle, label: h.label }))}
              disabled={dis}
            />
          </Field>
          <Field label="Technologie" htmlFor="technologieId">
            <Select
              name="technologieId"
              value={values.technologieId}
              options={refOptions(technologies)}
              disabled={dis}
              aucun="— non renseignée —"
            />
          </Field>
          <Field label="Open source / propriétaire" htmlFor="typeSource">
            <Select
              name="typeSource"
              value={values.typeSource}
              options={enumOptions(LIBELLES.typeSource)}
              disabled={dis}
            />
          </Field>
          {/* Le mode et son SECOND FACTEUR partagent un tiers de rangée : ils
              répondent à la même question — comment on entre dans ce logiciel —
              et « SSO, et avec un code à usage unique » se lit d'un trait. La
              case ne prend que la largeur de son libellé (`auto`), la liste
              garde le reste ; la carte, elle, conserve ses trois colonnes.

              Le vide est une réponse pour la liste : on ne sait pas toujours
              comment un logiciel authentifie ses utilisateurs, et un défaut à
              « Locale » le faisait dire à toutes les fiches sans que personne
              l'ait saisi. */}
          <div className="grid items-end gap-x-3 sm:grid-cols-[1fr_auto]">
            <Field label="Authentification" htmlFor="authentification">
              <Select
                name="authentification"
                value={values.authentification}
                options={enumOptions(LIBELLES.authentification)}
                disabled={dis}
                aucun="— inconnue —"
              />
            </Field>
            {/* Une case et non une liste — il y en a un, ou il n'y en a pas.
                Hauteur exacte d'un `.input` et case CENTRÉE sous son libellé,
                comme le « Virtuel » de la fiche serveur : seule de sa colonne,
                elle pendrait sinon au bord gauche. */}
            <Field label="2FA" htmlFor="authentificationForte">
              <div className="flex h-[1.85rem] items-center justify-center">
                <input
                  id="authentificationForte"
                  name="authentificationForte"
                  type="checkbox"
                  defaultChecked={values.authentificationForte}
                  disabled={dis}
                  className="h-4 w-4 accent-(--color-accent)"
                />
              </div>
            </Field>
          </div>
          <Field label="Date de mise en service" htmlFor="dateMiseEnService">
            <input
              id="dateMiseEnService"
              name="dateMiseEnService"
              type="date"
              defaultValue={values.dateMiseEnService}
              disabled={dis}
              className="input"
            />
          </Field>
          {/* Le référent technique rejoint la technique : c'est la personne à
              qui l'on parle d'hébergement, de version et d'authentification —
              les champs qui l'entourent désormais. Le référent métier, lui, est
              resté avec l'identité du logiciel. */}
          <Field label="Référent technique" htmlFor="referentTechnique">
            <input
              id="referentTechnique"
              name="referentTechnique"
              defaultValue={values.referentTechnique}
              disabled={dis}
              className="input"
            />
          </Field>
        </div>
      </Card>

      {error ? <p className="alert-error">{error}</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          {/* La ligne suit l'état du MODE, et non l'écart à l'enregistré.

              Fiche fermée : il n'y a rien à enregistrer, et le seul geste qui
              reste est de partir — « Quitter », en clair, puisqu'il ne décide de
              rien. Le crayon de la barre d'onglets ouvre le mode, et
              « Enregistrer » et « Annuler » paraissent AUSSITÔT : ce sont les
              issues de la modification qu'on vient d'ouvrir, et elles portent
              la FICHE ENTIÈRE — on modifie toute la fiche, on l'enregistre ou
              on la rend toute, quel que soit l'onglet d'où l'on clique.

              En CRÉATION, la fiche n'existe pas encore : rien à retrouver, donc
              « Annuler » y veut dire quitter, et il est toujours offert — on entre
              parfois ici par erreur. */}
          <div className="flex items-center gap-3">
            {id !== undefined && !ouvert ? (
              <button
                type="button"
                onClick={quitter}
                disabled={pending}
                className="btn-secondary"
                title="Revenir à la liste des logiciels"
              >
                Quitter
              </button>
            ) : (
              <>
                <button type="submit" disabled={pending || mode?.occupe} className="btn-primary">
                  {pending || mode?.occupe
                    ? "Enregistrement…"
                    : id === undefined
                      ? "Créer le logiciel"
                      : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={id === undefined ? quitterCreation : () => void mode?.annulerTout()}
                  disabled={pending || mode?.occupe}
                  className="btn-warn"
                  title={id === undefined ? "Quitter sans créer le logiciel" : undefined}
                >
                  Annuler
                </button>
              </>
            )}
            {/* La confirmation se range à la suite des boutons, là où le regard
                revient après le clic — plutôt qu'en bandeau, qui pousse la page. */}
            {saved ? (
              <span
                className="flex items-center gap-1.5 text-sm"
                style={{ color: "var(--color-ok-text)" }}
              >
                <Check className="h-4 w-4" />
                Fiche enregistrée.
              </span>
            ) : null}
          </div>
          {/* La corbeille garde son bout de ligne : elle ne porte pas sur la
              saisie en cours mais sur la fiche entière. Même composant que sur
              les autres onglets — la question posée et la garde des pièces
              jointes ne doivent pas dépendre de l'endroit d'où l'on supprime. */}
          {id === undefined ? null : (
            <BoutonSupprimerLogiciel id={id} nom={values.nom} nbPiecesJointes={nbPiecesJointes} />
          )}
        </div>
      )}

      {modaleSociete ? (
        <ModaleSociete
          onFermer={() => setModaleSociete(false)}
          onCreee={(societe) => {
            // Insérée dans l'ordre alphabétique, comme la liste du serveur, et
            // retenue aussitôt : c'est pour cette fiche-ci qu'on l'a créée.
            setAnnuaire((liste) =>
              [...liste, { id: societe.id, label: societe.nom }].sort((a, b) =>
                a.label.localeCompare(b.label, "fr"),
              ),
            );
            setASelectionner(societe.id);
            setModaleSociete(false);
          }}
        />
      ) : null}
    </form>
  );
}
