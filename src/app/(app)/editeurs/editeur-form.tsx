"use client";

import { Check, ExternalLink, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { FicheOnglets } from "@/components/fiche-onglets";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import { CATEGORIES_EDITEUR, LIBELLES_CATEGORIE_EDITEUR } from "@/schemas/editeur";
import { createEditeurAction, deleteEditeurAction, updateEditeurAction } from "./actions";
import { ONGLETS_EDITEUR, type OngletEditeur } from "./onglets";

export type EditeurValues = {
  nom: string;
  /** Clé de `CATEGORIES_EDITEUR` : editeur, fournisseur, autorite_certification. */
  categorie: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siteWeb: string;
  supportUrl: string;
  supportEmail: string;
  supportTelephone: string;
  numeroClient: string;
  supportHoraires: string;
  supportHoraires2: string;
  commercialContact: string;
  commercialTelephone: string;
  commercialEmail: string;
  commercialContact2: string;
  commercialTelephone2: string;
  commercialEmail2: string;
  adminContact: string;
  adminTelephone: string;
  adminEmail: string;
  dpoContact: string;
  dpoTelephone: string;
  dpoEmail: string;
  notes: string;
};

const VIDE: EditeurValues = {
  nom: "",
  categorie: "editeur",
  adresse: "",
  codePostal: "",
  ville: "",
  telephone: "",
  email: "",
  siteWeb: "",
  supportUrl: "",
  supportEmail: "",
  supportTelephone: "",
  numeroClient: "",
  supportHoraires: "",
  supportHoraires2: "",
  commercialContact: "",
  commercialTelephone: "",
  commercialEmail: "",
  commercialContact2: "",
  commercialTelephone2: "",
  commercialEmail2: "",
  adminContact: "",
  adminTelephone: "",
  adminEmail: "",
  dpoContact: "",
  dpoTelephone: "",
  dpoEmail: "",
  notes: "",
};

const FORM_ID = "editeur-form";

/**
 * Fiche éditeur en TROIS ONGLETS — Synthèse (coordonnées, logiciels rattachés),
 * Contacts, Documents — sur le modèle de la fiche logiciel : tous les panneaux
 * montés, masqués et non démontés au changement d'onglet, pour qu'une saisie
 * commencée survive à un détour.
 *
 * PARTICULARITÉ de cette fiche : les champs des onglets Synthèse et Contacts
 * appartiennent au MÊME enregistrement — un seul <form>, une seule action
 * serveur. Le formulaire ENVELOPPE donc les onglets, et les champs de l'onglet
 * masqué, simplement cachés, restent dans le `FormData` de l'envoi. C'est
 * l'inverse de la fiche logiciel, où chaque onglet porte le sien.
 *
 * `id` absent = création (redirige vers la fiche créée) : pas d'onglets, les
 * deux cartes de saisie empilées — logiciels et documents s'ajoutent après.
 * Le lecteur reçoit `readOnly` : champs désactivés, aucun bouton — la
 * protection réelle reste dans les server actions (requireRole admin).
 */
export function EditeurForm({
  id,
  values = VIDE,
  nbPiecesJointes = 0,
  readOnly = false,
  onglet = "synthese",
  logiciels,
  documents,
}: {
  id?: number;
  values?: EditeurValues;
  /**
   * Pièces jointes de la fiche. Tant qu'il y en a, le bouton Supprimer reste
   * grisé : la cascade PostgreSQL effacerait les lignes `documents` sans
   * retirer les fichiers du disque. L'action serveur applique la même règle.
   */
  nbPiecesJointes?: number;
  readOnly?: boolean;
  /** L'onglet demandé par l'URL au chargement. */
  onglet?: OngletEditeur;
  /** La carte des logiciels rattachés, rendue côté serveur — onglet Synthèse. */
  logiciels?: ReactNode;
  /** Le panneau des pièces jointes, rendu côté serveur — onglet Documents. */
  documents?: ReactNode;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saisie = useSaisieEnCours();
  /** Retour à SA liste, et non à la page précédente : arrivé par une URL collée
   *  ou un rechargement, un retour d'historique ferait sortir de l'application. */
  const quitter = () => router.push("/editeurs");

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. La laisser à l'écran, c'est laisser croire, au geste
   *  suivant, qu'elle parle de celui-là. */
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  /** Enregistre CE formulaire, à la demande du mode — sa part du
   *  « Enregistrer » global de la fiche. */
  async function enregistrerFormulaire(): Promise<boolean> {
    const form = saisie.formRef.current;
    if (id === undefined || !form) return true;
    if (!form.reportValidity()) return false;
    setError(null);
    const res = await updateEditeurAction(id, new FormData(form));
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
   * cette fiche », porté par la barre d'onglets et partagé avec le panneau de
   * documents. Le formulaire s'y inscrit avec ses trois réponses : dire s'il
   * porte une saisie, la rendre, l'enregistrer.
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
  /**
   * Les deux issues du mode ne paraissent qu'une fois la fiche TOUCHÉE : ouvrir
   * au crayon pour relire ne donne rien à enregistrer ni rien à rendre, et deux
   * boutons offerts pour rien invitent à un geste qui ne fait rien. En CRÉATION,
   * où il n'y a pas de mode, elles sont là d'emblée — c'est par elles qu'on crée.
   */
  const issues = mode ? mode.actif && mode.modifie : id === undefined;

  /**
   * `FormData` IGNORE les champs désactivés : l'empreinte relevée au premier
   * rendu, cartes verrouillées, ne vaut donc rien une fois les champs réveillés.
   * On la reprend à l'ouverture du mode — sans quoi la première frappe
   * comparerait un formulaire complet à un formulaire vide, et « Enregistrer »
   * paraîtrait de lui-même.
   */
  useEffect(() => {
    if (ouvert) saisie.enregistre();
  }, [ouvert, saisie.enregistre]);

  /**
   * Envoi du formulaire — bouton ou touche Entrée. Sur une fiche EXISTANTE, il
   * passe par le mode : on modifie toute la fiche, on l'enregistre toute. En
   * CRÉATION, il crée.
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
        id === undefined ? await createEditeurAction(form) : await updateEditeurAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/editeurs/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        saisie.enregistre();
        router.refresh();
      }
    });
  }

  /** « Annuler » en CRÉATION, où il veut dire quitter : la même question, pour
   *  ce qui est le même geste — renoncer à ce qu'on a tapé. */
  async function quitterCreation() {
    if (saisie.modifie) {
      const ok = await confirmer({
        question: "Quitter sans créer l'éditeur ?",
        detail: "La saisie en cours sera perdue.",
        action: "Quitter sans créer",
      });
      if (!ok) return;
    }
    quitter();
  }

  async function supprimer() {
    if (id === undefined) return;
    if (!(await confirmer({ question: `Supprimer l'éditeur « ${values.nom} » ?` }))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteEditeurAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/editeurs");
      router.refresh();
    });
  }

  const dis = readOnly || pending || !ouvert;
  /**
   * `placeholder` plutôt que `hint` quand l'aide n'est qu'un exemple de format :
   * elle occupe alors la place du champ vide au lieu d'ajouter une ligne sous
   * chacun, ce qui allonge la fiche entière. `hint` reste pour ce qui doit se
   * lire même une fois le champ rempli.
   */
  /**
   * Raccourci accolé au libellé d'une adresse : ouvrir le site, écrire au
   * contact. Il vaut pour ce qui est ENREGISTRÉ, pas pour ce qui est en train
   * d'être tapé — les champs sont non contrôlés, et un lien qui suivrait la
   * frappe mènerait à des adresses incomplètes, une lettre sur deux. Il paraît
   * donc après enregistrement, et disparaît si l'adresse est effacée.
   *
   * Le type du champ suffit à décider : `url` et `email` ne sont portés que par
   * les six adresses de la fiche.
   */
  const lienDe = (name: keyof EditeurValues, type?: string) => {
    const valeur = values[name]?.trim();
    if (!valeur || (type !== "url" && type !== "email")) return null;
    const mail = type === "email";
    // Une adresse saisie sans protocole — « www.editeur.fr » — serait comprise
    // comme un chemin relatif et mènerait à une page de l'application.
    const href = mail
      ? `mailto:${valeur}`
      : /^https?:\/\//i.test(valeur)
        ? valeur
        : `https://${valeur}`;
    const Icone = mail ? Mail : ExternalLink;
    return (
      <a
        href={href}
        {...(mail ? {} : { target: "_blank", rel: "noreferrer noopener" })}
        title={mail ? `Écrire à ${valeur}` : `Ouvrir ${valeur}`}
        aria-label={mail ? `Écrire à ${valeur}` : `Ouvrir ${valeur}`}
        className="shrink-0 text-faint transition hover:text-accent"
      >
        <Icone className="h-3 w-3" />
      </a>
    );
  };

  /**
   * `aussi` accroche au MÊME libellé le raccourci d'un second champ, celui de
   * la ligne muette en dessous : elle n'a pas de libellé où le poser. Les deux
   * enveloppes se suivent alors dans l'ordre des lignes, et leur infobulle —
   * « Écrire à … » suivi de l'adresse — dit laquelle mène où.
   */
  const champ = (
    name: keyof EditeurValues,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string; aussi?: keyof EditeurValues },
  ) => (
    <Field
      label={label}
      htmlFor={name}
      hint={opts?.hint}
      action={
        <>
          {lienDe(name, opts?.type)}
          {opts?.aussi ? lienDe(opts.aussi, opts?.type) : null}
        </>
      }
    >
      <input
        id={name}
        name={name}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        defaultValue={values[name]}
        disabled={dis}
        className="input"
      />
    </Field>
  );

  /**
   * Un champ SANS libellé, pour une ligne qui prolonge celle du dessus : le
   * second commercial tombe sous le premier, colonne par colonne, et coiffer
   * chaque case d'un « Contact commercial 2 » n'apprendrait rien que la
   * position ne dise déjà — la carte y gagne trois lignes de titres en moins.
   *
   * `aria-label` porte quand même le nom : sans mise en page sous les yeux, la
   * position ne se voit pas, et le champ serait annoncé sans rien dire.
   *
   * Son raccourci d'adresse, lui, ne peut pas vivre ici : il s'accroche à un
   * libellé, et cette ligne n'en a pas. Il est accroché à celui du champ du
   * dessus — voir `aussi` dans `champ`.
   */
  const champNu = (
    name: keyof EditeurValues,
    label: string,
    opts?: { type?: string; placeholder?: string },
  ) => (
    <input
      id={name}
      name={name}
      type={opts?.type ?? "text"}
      aria-label={label}
      placeholder={opts?.placeholder}
      defaultValue={values[name]}
      disabled={dis}
      className="input"
    />
  );

  const carteCoordonnees = (
    <Card title="Coordonnées">
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
        {/* Première ligne en 3/8 - 1/4 - 3/8 — nom, catégorie, site — la
            catégorie collée au nom : elle dit ce qu'EST la société, avant où
            la joindre. Étroite : c'est une liste à trois choix, le nom et
            l'URL ont plus à montrer. */}
        <div className="grid gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-[3fr_2fr_3fr]">
          <Field label="Nom de l'éditeur" htmlFor="nom" required>
            <input
              id="nom"
              name="nom"
              defaultValue={values.nom}
              required
              disabled={dis}
              className="input"
            />
          </Field>
          <Field label="Catégorie" htmlFor="categorie">
            <select
              id="categorie"
              name="categorie"
              defaultValue={values.categorie}
              disabled={dis}
              className="input"
            >
              {CATEGORIES_EDITEUR.map((c) => (
                <option key={c} value={c}>
                  {LIBELLES_CATEGORIE_EDITEUR[c]}
                </option>
              ))}
            </select>
          </Field>
          {champ("siteWeb", "Site web", { type: "url", placeholder: "https://…" })}
        </div>
        {champ("adresse", "Adresse")}
        <div className="grid grid-cols-[8rem_1fr] gap-4">
          {champ("codePostal", "Code postal")}
          {champ("ville", "Ville")}
        </div>
        {/* Téléphone et e-mail en tiers, comme la première ligne : le dernier
            tiers reste vide, un numéro et une adresse n'ont pas à s'étaler
            sur des demi-largeurs. */}
        <div className="grid gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-3">
          {champ("telephone", "Téléphone standard", { type: "tel" })}
          {champ("email", "E-mail", { type: "email" })}
        </div>
        {/* Pleine largeur : c'est de la prose, elle ne se lit pas en
                colonne de 8 rem comme un code postal. */}
        <div className="sm:col-span-2">
          <Field label="Observations" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              defaultValue={values.notes}
              disabled={dis}
              rows={3}
              className="input"
              placeholder="Informations libres : interlocuteurs, historique, particularités du contrat…"
            />
          </Field>
        </div>
      </div>
    </Card>
  );

  /* Tous les interlocuteurs de l'éditeur dans une seule carte, une ligne
     de trois tiers par interlocuteur : l'assistance, puis ses horaires
     en pleine largeur — une plage se lit d'un trait —, puis le
     commercial et l'administratif, chacun sur son rang « qui, son
     numéro, son adresse ». L'onglet Contacts du logiciel reprend cette
     grille.

     `items-end` : au tiers de largeur, « Téléphone administratif »
     passe sur deux lignes là où « Mail » tient sur une. Aligner les
     cellules par le BAS garde les champs sur la même ligne, quel que
     soit le nombre de lignes du libellé. */
  const carteContacts = (
    <Card title="Contacts">
      <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
        {/* Le rang de l'assistance se coupe en SIXIÈMES : 2/1/1/2. Le
                portail et le mail sont des adresses, qui ont besoin de la
                largeur ; le numéro d'appel et le numéro de client tiennent en
                dix caractères. Le second suit le premier parce que c'est dans
                cet ordre qu'on s'en sert — on compose, puis on l'annonce.

                Sous-grille, la carte étant en trois tiers : elle ne sait pas
                couper un tiers en deux. */}
        <div
          className="grid items-end gap-x-3 gap-y-2 sm:col-span-3"
          style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr" }}
        >
          {champ("supportUrl", "Portail de tickets", { type: "url", placeholder: "https://…" })}
          {champ("supportTelephone", "Tél du support", { type: "tel" })}
          {champ("numeroClient", "N° de client")}
          {champ("supportEmail", "Mail du support", { type: "email" })}
        </div>
        {/* Deux lignes plutôt qu'une : les horaires décrivent presque
                toujours deux régimes — la semaine, puis le jour qui en sort.
                Cousus sur une seule ligne, chaque fiche inventait sa ponctuation
                (« — », « / », « | ») et la liste ne pouvait rien en faire. La
                seconde reste vide quand la semaine est d'un bloc. */}
        {/* Deux moitiés sur une seule ligne, et non deux rangs pleine
                largeur : ce sont les deux versants d'une même information, et
                la grille de trois tiers ne sait pas les couper en deux. D'où la
                sous-grille — `items-end` comme la grille mère, le second libellé
                passant sur deux lignes là où le premier tient sur une. */}
        <div className="grid items-end gap-x-3 gap-y-2 sm:col-span-3 sm:grid-cols-2">
          {champ("supportHoraires", "Horaires du support", {
            placeholder: "Ex : lundi au vendredi 8h-17h",
          })}
          {champ("supportHoraires2", "Horaires du support (2ᵉ ligne)", {
            placeholder: "Ex : samedi 8h-12h",
          })}
        </div>
        {champ("commercialContact", "Contact commercial")}
        {champ("commercialTelephone", "Tél commercial", { type: "tel" })}
        {champ("commercialEmail", "Mail commercial", {
          type: "email",
          aussi: "commercialEmail2",
        })}
        {champNu("commercialContact2", "Contact commercial 2")}
        {champNu("commercialTelephone2", "Tél commercial 2", { type: "tel" })}
        {champNu("commercialEmail2", "Mail commercial 2", { type: "email" })}
        {champ("adminContact", "Contact administratif")}
        {champ("adminTelephone", "Tél administratif", { type: "tel" })}
        {champ("adminEmail", "Mail administratif", { type: "email" })}
        {/* Le DPO de l'ÉDITEUR, sur le même rang « qui, son numéro, son
                adresse » que le commercial et l'administratif : c'est à lui
                qu'on écrit pour une violation de données ou une demande
                d'exercice de droits chez ce fournisseur. */}
        {champ("dpoContact", "DPO")}
        {champ("dpoTelephone", "Tél DPO", { type: "tel" })}
        {champ("dpoEmail", "Mail DPO", { type: "email" })}
      </div>
    </Card>
  );

  /**
   * La ligne d'actions, SOUS CHAQUE ONGLET : les deux issues du mode portent la
   * fiche entière, elles doivent donc se trouver partout — y compris sous les
   * Documents, qui n'ont pourtant rien dans le <form>.
   *
   * Fiche fermée : il n'y a rien à enregistrer, et le seul geste qui reste est
   * de partir — « Quitter », en clair, puisqu'il ne décide de rien. Le crayon
   * ouvre le mode, et « Enregistrer » et « Annuler » paraissent AUSSITÔT.
   *
   * En CRÉATION, la fiche n'existe pas encore : rien à retrouver, donc
   * « Annuler » y veut dire quitter, et il est toujours offert — on entre
   * parfois ici par erreur.
   */
  const ligneActions = readOnly ? null : (
    <>
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {id !== undefined && !issues ? (
            <button
              type="button"
              onClick={quitter}
              disabled={pending}
              className="btn-secondary"
              title="Revenir à la liste des éditeurs"
            >
              Quitter
            </button>
          ) : (
            <>
              <button
                type="submit"
                form={FORM_ID}
                disabled={pending || mode?.occupe}
                className="btn-primary"
              >
                {pending || mode?.occupe
                  ? "Enregistrement…"
                  : id === undefined
                    ? "Créer l'éditeur"
                    : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={id === undefined ? quitterCreation : () => void mode?.annulerTout()}
                disabled={pending || mode?.occupe}
                className="btn-warn"
                title={id === undefined ? "Quitter sans créer l'éditeur" : undefined}
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
            saisie en cours mais sur la fiche entière. */}
        {id === undefined ? null : (
          <button
            type="button"
            onClick={supprimer}
            disabled={pending || nbPiecesJointes > 0}
            title={
              nbPiecesJointes > 0
                ? `Suppression impossible : ${nbPiecesJointes === 1 ? "1 pièce jointe" : `${nbPiecesJointes} pièces jointes`} sur cette fiche, à retirer d'abord.`
                : undefined
            }
            className="btn-danger"
          >
            Supprimer
          </button>
        )}
      </div>
    </>
  );

  /* En CRÉATION, pas d'onglets : les deux cartes de saisie empilées — les
     logiciels rattachés et les pièces jointes s'ajoutent après création. */
  if (id === undefined) {
    return (
      <form
        id={FORM_ID}
        ref={saisie.formRef}
        onSubmit={submit}
        onChange={saisie.surSaisie}
        className="space-y-3"
      >
        {carteCoordonnees}
        {carteContacts}
        {ligneActions}
      </form>
    );
  }

  /* Le <form> ENVELOPPE les onglets : Synthèse et Contacts saisissent le même
     enregistrement, et les champs de l'onglet masqué — cachés, pas démontés —
     restent dans le FormData de l'envoi. Le panneau Documents, embarqué du même
     coup, n'y met rien : aucun de ses contrôles n'est nommé. */
  return (
    <form
      id={FORM_ID}
      ref={saisie.formRef}
      onSubmit={submit}
      onChange={saisie.surSaisie}
      className="space-y-3"
    >
      <FicheOnglets
        onglets={ONGLETS_EDITEUR}
        initial={onglet}
        base={`/editeurs/${id}`}
        panneaux={{
          synthese: (
            <div className="space-y-3">
              {carteCoordonnees}
              {logiciels}
              {ligneActions}
            </div>
          ),
          contacts: (
            <div className="space-y-3">
              {carteContacts}
              {ligneActions}
            </div>
          ),
          documents: (
            <div className="space-y-3">
              {documents}
              {ligneActions}
            </div>
          ),
        }}
      />
    </form>
  );
}
