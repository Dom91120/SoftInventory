"use client";

import { Check, ExternalLink, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import { createEditeurAction, deleteEditeurAction, updateEditeurAction } from "./actions";

export type EditeurValues = {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siteWeb: string;
  supportUrl: string;
  supportEmail: string;
  supportTelephone: string;
  supportHoraires: string;
  supportHoraires2: string;
  commercialContact: string;
  commercialTelephone: string;
  commercialEmail: string;
  adminContact: string;
  adminTelephone: string;
  adminEmail: string;
  notes: string;
};

const VIDE: EditeurValues = {
  nom: "",
  adresse: "",
  codePostal: "",
  ville: "",
  telephone: "",
  email: "",
  siteWeb: "",
  supportUrl: "",
  supportEmail: "",
  supportTelephone: "",
  supportHoraires: "",
  supportHoraires2: "",
  commercialContact: "",
  commercialTelephone: "",
  commercialEmail: "",
  adminContact: "",
  adminTelephone: "",
  adminEmail: "",
  notes: "",
};

/** Cible du bouton d'enregistrement, qui vit HORS du <form> — voir `children`. */
const FORM_ID = "editeur-form";

/**
 * Formulaire de fiche éditeur, en deux cartes : la société (coordonnées et
 * observations) puis ses contacts (assistance, commercial, administratif).
 * `id` absent = création (redirige vers la fiche créée). Le lecteur reçoit
 * `readOnly` : champs désactivés, aucun bouton — la protection réelle reste
 * dans les server actions (requireRole admin).
 */
export function EditeurForm({
  id,
  values = VIDE,
  nbPiecesJointes = 0,
  readOnly = false,
  children,
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
  /**
   * Le reste de la fiche (logiciels rattachés, pièces jointes), posé ENTRE les
   * cartes de saisie et la ligne d'actions : Enregistrer et Supprimer closent
   * la page, pas seulement le formulaire.
   *
   * Rendu hors du <form> — le panneau de documents porte ses propres champs, et
   * une touche Entrée y déclencherait l'enregistrement de la fiche. D'où
   * l'attribut `form` sur le bouton de soumission, qui le rattache au
   * formulaire sans être dedans.
   */
  children?: ReactNode;
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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
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

  const dis = readOnly || pending;
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

  const champ = (
    name: keyof EditeurValues,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string },
  ) => (
    <Field label={label} htmlFor={name} hint={opts?.hint} action={lienDe(name, opts?.type)}>
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

  return (
    <div className="space-y-3">
      <form
        id={FORM_ID}
        ref={saisie.formRef}
        onSubmit={submit}
        onChange={saisie.surSaisie}
        className="space-y-3"
      >
        <Card title="Coordonnées">
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
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
            {champ("siteWeb", "Site web", { type: "url", placeholder: "https://…" })}
            {champ("adresse", "Adresse")}
            <div className="grid grid-cols-[8rem_1fr] gap-4">
              {champ("codePostal", "Code postal")}
              {champ("ville", "Ville")}
            </div>
            {champ("telephone", "Téléphone standard", { type: "tel" })}
            {champ("email", "E-mail", { type: "email" })}
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

        {/* Tous les interlocuteurs de l'éditeur dans une seule carte, une ligne
            de trois tiers par interlocuteur : l'assistance, puis ses horaires
            en pleine largeur — une plage se lit d'un trait —, puis le
            commercial et l'administratif, chacun sur son rang « qui, son
            numéro, son adresse ». L'onglet Contacts du logiciel reprend cette
            grille.

            `items-end` : au tiers de largeur, « Téléphone administratif »
            passe sur deux lignes là où « Mail » tient sur une. Aligner les
            cellules par le BAS garde les champs sur la même ligne, quel que
            soit le nombre de lignes du libellé. */}
        <Card title="Contacts">
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
            {champ("supportUrl", "Portail de tickets", { type: "url", placeholder: "https://…" })}
            {champ("supportTelephone", "Téléphone du support", { type: "tel" })}
            {champ("supportEmail", "Mail du support", { type: "email" })}
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
                placeholder: "Ex. lundi au vendredi 8h-17h",
              })}
              {champ("supportHoraires2", "Horaires du support (2ᵉ ligne)", {
                placeholder: "Ex. samedi 8h-12h",
              })}
            </div>
            {champ("commercialContact", "Contact commercial")}
            {champ("commercialTelephone", "Téléphone commercial", { type: "tel" })}
            {champ("commercialEmail", "Mail commercial", { type: "email" })}
            {champ("adminContact", "Contact administratif")}
            {champ("adminTelephone", "Téléphone administratif", { type: "tel" })}
            {champ("adminEmail", "Mail administratif", { type: "email" })}
          </div>
        </Card>
      </form>

      {children}

      {error ? <p className="alert-error">{error}</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          {/* La ligne suit l'état de la saisie plutôt que d'offrir tout, tout le
              temps.

              Fiche EXISTANTE, rien de modifié : il n'y a rien à enregistrer, et
              le seul geste qui reste est de partir — « Quitter », en clair,
              puisqu'il ne décide de rien. Dès qu'un champ change, « Enregistrer »
              prend sa place et « Annuler » le rejoint, qui rend au formulaire ses
              valeurs enregistrées, sans confirmation : il n'y a que des frappes
              non sauvegardées à perdre.

              En CRÉATION, la fiche n'existe pas encore : rien à retrouver, donc
              « Annuler » y veut dire quitter, et il est toujours offert — on entre
              parfois ici par erreur. */}
          <div className="flex items-center gap-3">
            {id !== undefined && !saisie.modifie ? (
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
                <button type="submit" form={FORM_ID} disabled={pending} className="btn-primary">
                  {pending
                    ? "Enregistrement…"
                    : id === undefined
                      ? "Créer l'éditeur"
                      : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={id === undefined ? quitter : saisie.annuler}
                  disabled={pending}
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
      )}
    </div>
  );
}
