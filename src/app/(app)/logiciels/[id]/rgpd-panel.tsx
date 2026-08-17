"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import { LIBELLES } from "@/schemas/logiciel";
import { updateRgpdAction } from "../actions";

export type RgpdValues = {
  donneesPersonnelles: boolean;
  categoriesDonnees: string;
  registreRef: string;
  localisationDonnees: string;
};

/** Onglet RGPD : volet simple par logiciel (données personnelles, registre, localisation). */
export function RgpdPanel({
  logicielId,
  values,
  readOnly,
  supprimer,
}: {
  logicielId: number;
  values: RgpdValues;
  readOnly: boolean;
  /**
   * La corbeille de la fiche, posée au bout de la ligne d'actions. Reçue de la
   * page plutôt que rendue ici : elle porte sur le logiciel entier, pas sur le
   * volet RGPD, et c'est la page qui sait compter ses pièces jointes.
   */
  supprimer?: ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [traite, setTraite] = useState(values.donneesPersonnelles);
  const saisie = useSaisieEnCours();

  /** Retour à SA liste, et non à la page précédente : arrivé par une URL collée
   *  ou un rechargement, un retour d'historique ferait sortir de l'application. */
  const quitter = () => router.push("/logiciels");

  /**
   * « Annuler » : rend au volet ses valeurs enregistrées. `reset()` rend au DOM
   * les siennes, mais la case vit dans un état React qu'il n'atteint pas —
   * sans la première ligne, le volet resterait déplié sur une case redevenue
   * décochée.
   */
  const annuler = () => {
    setTraite(values.donneesPersonnelles);
    saisie.annuler();
  };

  /** Enregistre CE volet, à la demande du mode — sa part du « Enregistrer »
   *  global de la fiche. */
  async function enregistrerVolet(): Promise<boolean> {
    const form = saisie.formRef.current;
    if (!form) return true;
    if (!form.reportValidity()) return false;
    setError(null);
    const res = await updateRgpdAction(logicielId, new FormData(form));
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
   * Le volet n'a plus son propre verrou : il lit LE mode « je modifie cette
   * fiche » de la barre d'onglets, et s'y inscrit avec ses trois réponses —
   * dire s'il porte une saisie, la rendre, l'enregistrer.
   */
  const mode = useInscriptionModeFiche({
    sale: () => saisie.modifie,
    rendre: annuler,
    enregistrer: enregistrerVolet,
  });
  const ouvert = !!mode?.actif;
  /** L'enregistrement en cours vient du MODE : c'est lui qui pilote l'envoi. */
  const pending = !!mode?.occupe;
  const dis = readOnly || pending || !ouvert;

  /**
   * `FormData` IGNORE les champs désactivés : l'empreinte relevée au premier
   * rendu, volet verrouillé, ne vaut donc rien une fois les champs réveillés. On
   * la reprend à l'ouverture du mode — sans quoi la première frappe comparerait
   * un formulaire complet à un formulaire vide.
   */
  useEffect(() => {
    if (ouvert) saisie.enregistre();
  }, [ouvert, saisie.enregistre]);

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. La laisser à l'écran, c'est laisser croire, au geste
   *  suivant, qu'elle parle de celui-là. */
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  /** Envoi du formulaire — bouton ou touche Entrée : le « Enregistrer » de la
   *  FICHE. Chaque onglet qui porte une saisie enregistre la sienne. */
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    void mode?.enregistrerTout();
  }

  return (
    <form ref={saisie.formRef} onSubmit={submit} onChange={saisie.surSaisie} className="space-y-3">
      <Card title="Données personnelles">
        <label className="flex items-center gap-3 text-sm text-body">
          <input
            type="checkbox"
            name="donneesPersonnelles"
            checked={traite}
            onChange={(e) => setTraite(e.target.checked)}
            // `defaultChecked` posé À LA MAIN, aligné sur l'enregistré : la case
            // est contrôlée, et `reset()` — le geste d'« Annuler » — rend au DOM
            // son defaultChecked, qui sans cela n'existe pas (donc décoché).
            // React, dont l'état n'a pas bougé, ne recommettait pas la propriété :
            // la case DOM restait décochée derrière une case React cochée, et
            // l'enregistrement suivant, qui lit le DOM (`FormData`), envoyait
            // « décochée ». Via une ref parce que React interdit de déclarer
            // `checked` et `defaultChecked` ensemble.
            ref={(el) => {
              if (el) el.defaultChecked = values.donneesPersonnelles;
            }}
            disabled={dis}
            className="h-4 w-4 accent-(--color-accent)"
          />
          Ce logiciel traite des données personnelles
        </label>
        {traite ? (
          <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Catégories de données traitées" htmlFor="categoriesDonnees">
                <textarea
                  id="categoriesDonnees"
                  name="categoriesDonnees"
                  placeholder="Ex : état civil, coordonnées, données financières, données de santé…"
                  rows={3}
                  defaultValue={values.categoriesDonnees}
                  disabled={dis}
                  className="input"
                />
              </Field>
            </div>
            <Field
              label="Référence au registre des traitements"
              htmlFor="registreRef"
              hint="Numéro ou intitulé de la fiche du registre tenue avec le DPO."
            >
              <input
                id="registreRef"
                name="registreRef"
                defaultValue={values.registreRef}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Localisation des données" htmlFor="localisationDonnees">
              <select
                id="localisationDonnees"
                name="localisationDonnees"
                defaultValue={values.localisationDonnees}
                disabled={dis}
                className="input"
              >
                {Object.entries(LIBELLES.localisationDonnees).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          // Champs conservés dans le formulaire même masqués : décocher ne doit
          // pas effacer silencieusement ce qui avait été renseigné.
          <div className="hidden">
            <input name="categoriesDonnees" defaultValue={values.categoriesDonnees} />
            <input name="registreRef" defaultValue={values.registreRef} />
            <input name="localisationDonnees" defaultValue={values.localisationDonnees} />
          </div>
        )}
      </Card>
      {error ? <p className="alert-error">{error}</p> : null}
      {/* Une seule ligne d'actions, comme sur la Synthèse : la saisie à gauche,
          la corbeille au bout. Elle est rendue même en lecture seule — « Quitter »
          n'est pas une modification, et le lecteur doit pouvoir refermer la
          fiche depuis cet onglet comme depuis les autres. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Comme dans l'onglet Synthèse, la ligne suit l'état du MODE, et
              ses deux boutons portent la FICHE ENTIÈRE : « Enregistrer »
              enregistre chaque onglet qui porte une saisie, « Annuler » rend
              tout et referme — le même geste que le crayon. Ils ne paraissent
              qu'une fois la fiche touchée : ouvrir au crayon pour relire ne
              donne rien à enregistrer ni rien à rendre. */}
          {!readOnly && ouvert && mode?.modifie ? (
            <>
              <button type="submit" disabled={pending || mode?.occupe} className="btn-primary">
                {pending || mode?.occupe ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => void mode?.annulerTout()}
                disabled={pending || mode?.occupe}
                className="btn-warn"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={quitter}
              disabled={pending}
              className="btn-secondary"
              title="Revenir à la liste des logiciels"
            >
              Quitter
            </button>
          )}
          {/* La confirmation se range à la suite des boutons, là où le regard
              revient après le clic — plutôt qu'au-dessus, où elle les pousse. */}
          {saved ? (
            <span
              className="flex items-center gap-1.5 text-sm"
              style={{ color: "var(--color-ok-text)" }}
            >
              <Check className="h-4 w-4" />
              Volet RGPD enregistré.
            </span>
          ) : null}
        </div>
        {supprimer}
      </div>
    </form>
  );
}
