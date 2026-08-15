"use client";

import { useRef, useState, useTransition } from "react";
import { createLogicielAction } from "@/app/(app)/logiciels/actions";
import { Card, Field } from "@/components/ui";
import { EDITEUR_INTERNE, LIBELLES } from "@/schemas/logiciel";

type Option = { id: number; label: string };
/** Référentiel dont la CLÉ est celle d'un enum : le libellé s'administre, pas la clé. */
type OptionCle = { cle: string; label: string };

/**
 * Création d'un logiciel absent de l'inventaire sans quitter la saisie en
 * cours. Même geste et même forme que `ModaleSociete` : on découvre que
 * l'application manque au moment de la déclarer installée quelque part, et
 * aller la créer ailleurs coûterait la saisie en cours.
 *
 * Elle reprend la SYNTHÈSE ENTIÈRE — ses deux cartes, tous ses champs, dans le
 * même ordre et sous les mêmes libellés : ce qui se saisit ici est une fiche,
 * pas un brouillon à compléter ailleurs. Ce qui n'y est pas ne pouvait pas y
 * être : les six autres onglets (liaisons, marchés, devis, tâches, documents,
 * RGPD) ne s'attachent qu'à un logiciel qui existe. Les clés étant celles de la
 * page logiciel, la même server action valide le tout, avec les mêmes règles et
 * les mêmes messages.
 *
 * Pas de <form> ici : la modale s'affiche À L'INTÉRIEUR de l'écran appelant, et
 * un formulaire imbriqué est invalide en HTML. D'où les champs relus à la main
 * depuis le conteneur, la soumission au clic, et l'interception d'Entrée qui
 * validerait sinon le formulaire du dessous.
 */
export function ModaleLogiciel({
  editeurs,
  technologies,
  criticites,
  statuts,
  hebergements,
  onFermer,
  onCree,
}: {
  editeurs: Option[];
  technologies: Option[];
  criticites: Option[];
  statuts: OptionCle[];
  hebergements: OptionCle[];
  onFermer: () => void;
  onCree: (logiciel: { id: number; nom: string }) => void;
}) {
  const champsRef = useRef<HTMLDivElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function creer() {
    const conteneur = champsRef.current;
    if (!conteneur) return;
    // Faute de <form>, on reconstitue le FormData depuis les champs nommés :
    // les mêmes clés que la page logiciel, donc la même server action. Les
    // champs qu'on ne saisit pas ici arrivent absents, et `parseFiche` les lit
    // comme vides — ce que le formulaire de création enverrait aussi.
    const form = new FormData();
    for (const el of conteneur.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("[name]")) {
      form.set(el.name, el.value);
    }
    const nom = String(form.get("nom") ?? "").trim();
    if (nom === "") {
      setErreur("Le nom du logiciel est obligatoire.");
      return;
    }
    setErreur(null);
    startTransition(async () => {
      const res = await createLogicielAction(form);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      if (res.id === undefined) {
        setErreur("Logiciel créé, mais impossible de le sélectionner. Rechargez la page.");
        return;
      }
      onCree({ id: res.id, nom });
    });
  }

  const liste = (
    name: string,
    label: string,
    options: Array<{ value: string; label: string }>,
    opts?: { defaut?: string; aucun?: string },
  ) => (
    <Field label={label} htmlFor={`log-${name}`}>
      <select
        id={`log-${name}`}
        name={name}
        defaultValue={opts?.defaut ?? ""}
        disabled={pending}
        className="input"
      >
        {opts?.aucun !== undefined ? <option value="">{opts.aucun}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  /** Champ de saisie simple — les mêmes libellés et types que la fiche. */
  const champ = (
    name: string,
    label: string,
    opts?: { type?: string; placeholder?: string; max?: number; infobulle?: string },
  ) => (
    <Field label={label} htmlFor={`log-${name}`} infobulle={opts?.infobulle}>
      <input
        id={`log-${name}`}
        name={name}
        type={opts?.type ?? "text"}
        min={opts?.type === "number" ? 0 : undefined}
        maxLength={opts?.max}
        placeholder={opts?.placeholder}
        disabled={pending}
        className="input"
      />
    </Field>
  );

  const parId = (l: Option[]) => l.map((o) => ({ value: String(o.id), label: o.label }));
  const parCle = (l: OptionCle[]) => l.map((o) => ({ value: o.cle, label: o.label }));
  const parEnum = (libelles: Record<string, string>) =>
    Object.entries(libelles).map(([value, label]) => ({ value, label }));

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
        // Entrée validerait le formulaire du dessous. On la détourne vers la
        // création — sauf dans la description, où elle sert à aller à la ligne.
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          creer();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-logiciel"
        className="my-8 w-full max-w-3xl rounded-2xl border border-line bg-surface px-5 py-4 shadow-lg"
      >
        <h3
          id="titre-logiciel"
          className="mb-3 text-sm font-bold uppercase tracking-wider text-muted"
        >
          Nouveau logiciel
        </h3>
        {erreur ? <p className="alert-error mb-3">{erreur}</p> : null}

        {/* Les DEUX cartes de la Synthèse, telles quelles : mêmes libellés,
            mêmes rangs, mêmes parts de largeur, même composant `Card` avec sa
            barre d'accent. La modale reprend la fiche plutôt que de la
            paraphraser — ce qui se saisit ici est une Synthèse entière. */}
        <div ref={champsRef} className="space-y-3">
          <Card title="Identité">
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              {/* Ce qui NOMME le logiciel sur un seul rang, aux parts de la
                  fiche — 25 / 8 / 33 / 33 : un numéro de version tient en six
                  caractères, une URL en soixante. */}
              <div
                className="grid items-end gap-x-3 gap-y-2 sm:col-span-2"
                style={{ gridTemplateColumns: "25fr 8fr 33fr 33fr" }}
              >
                <Field label="Nom du logiciel" htmlFor="log-nom" required>
                  <input
                    // biome-ignore lint/a11y/noAutofocus: la modale vient d'être ouverte par un clic délibéré sur « + ».
                    autoFocus
                    id="log-nom"
                    name="nom"
                    required
                    maxLength={150}
                    disabled={pending}
                    className="input"
                  />
                </Field>
                {/* La version se serre contre le nom : ensemble ils disent la
                    même chose, « Adagio 6.2 ». Mêmes retrait et plancher que sur
                    la fiche, pour la même raison — « VERSION » cloue sa piste à
                    57 px sur une fenêtre étroite. */}
                <div className="-ml-2 w-[calc(100%_+_0.5rem)] min-w-[65px]">
                  {champ("versionInstallee", "Version", { max: 60 })}
                </div>
                {/* Une seule liste pour une seule question : qui édite ce
                    logiciel ? « Développement interne » y est une réponse comme
                    une autre, et redevient le booléen `developpementInterne`
                    côté serveur. Sans le « + » de la fiche : une modale n'en
                    ouvre pas une seconde — l'éditeur se crée depuis son écran ou
                    depuis la fiche du logiciel, une fois celle-ci créée. */}
                {liste(
                  "editeurId",
                  "Éditeur",
                  [
                    { value: EDITEUR_INTERNE, label: "— développement interne —" },
                    ...parId(editeurs),
                  ],
                  { aucun: "— aucun —" },
                )}
                {champ("url", "URL de l'application", {
                  type: "url",
                  placeholder: "https://…",
                  infobulle: "Lien direct vers le produit quand il est accessible en mode web.",
                })}
              </div>
              {/* Ce qui QUALIFIE le logiciel, aux parts de la fiche —
                  12 / 15 / 9 / 9 / 55 : quatre pastilles ou chiffres, puis un
                  nom de personne. `items-end` garde les cinq champs sur le même
                  rang quand un libellé se replie. */}
              <div
                className="grid items-end gap-x-3 gap-y-2 sm:col-span-2"
                style={{ gridTemplateColumns: "12fr 15fr 9fr 9fr 55fr" }}
              >
                {liste("statut", "Statut", parCle(statuts), { defaut: "production" })}
                {liste("criticiteId", "Criticité", parId(criticites), { aucun: "— non évaluée —" })}
                {champ("nbUtilisateurs", "Utilisateurs", {
                  type: "number",
                  infobulle:
                    "Nombre d'utilisateurs. Vide = pas encore compté, différent de 0 utilisateur.",
                })}
                {champ("nbMaxUtilisateurs", "Max", {
                  type: "number",
                  infobulle:
                    "Nombre d'utilisateurs maximum. Plafond prévu au contrat. Vide = illimité.",
                })}
                {champ("referentMetier", "Référent métier", { max: 150 })}
              </div>
              {/* Le descriptif ferme la carte : seul champ long, il tient les
                  deux colonnes. */}
              <div className="sm:col-span-2">
                <Field label="Descriptif" htmlFor="log-description">
                  <textarea
                    id="log-description"
                    name="description"
                    rows={4}
                    disabled={pending}
                    className="input"
                    placeholder="À quoi sert ce logiciel, pour qui… puis historique, particularités, points de vigilance."
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Six champs courts en trois tiers, deux rangs pleins — la carte
              Technique de la fiche, dans le même ordre. */}
          <Card title="Technique">
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-3">
              {liste("hebergement", "Hébergement", parCle(hebergements), {
                defaut: hebergements.some((h) => h.cle === "on_premise") ? "on_premise" : undefined,
              })}
              {liste("technologieId", "Technologie", parId(technologies), {
                aucun: "— non renseignée —",
              })}
              {liste("typeSource", "Open source / propriétaire", parEnum(LIBELLES.typeSource), {
                defaut: "proprietaire",
              })}
              {liste("authentification", "Authentification", parEnum(LIBELLES.authentification), {
                defaut: "locale",
              })}
              {champ("dateMiseEnService", "Date de mise en service", { type: "date" })}
              {champ("referentTechnique", "Référent technique", { max: 150 })}
            </div>
          </Card>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={creer}>
            {pending ? "Création…" : "Créer le logiciel"}
          </button>
          <button type="button" className="btn-warn" disabled={pending} onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
