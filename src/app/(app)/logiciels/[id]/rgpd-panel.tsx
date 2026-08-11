"use client";

import { Check, SquarePen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [traite, setTraite] = useState(values.donneesPersonnelles);
  const saisie = useSaisieEnCours();

  /**
   * Le verrou de la carte Identité, et non l'interrupteur des onglets voisins :
   * ce volet est un FORMULAIRE, ses valeurs attendent un enregistrement. Le
   * crayon l'ouvre, la coche enregistre, la croix rend les valeurs enregistrées.
   *
   * Fermé d'office : on consulte le volet pour répondre à une question — ce
   * logiciel traite-t-il des données ? où ? — bien plus souvent qu'on ne le
   * corrige, et ses cases se décochent d'un clic malheureux.
   */
  const [verrouille, setVerrouille] = useState(true);
  const dis = readOnly || pending || verrouille;
  /** Retour à SA liste, et non à la page précédente : arrivé par une URL collée
   *  ou un rechargement, un retour d'historique ferait sortir de l'application. */
  const quitter = () => router.push("/logiciels");
  /** `reset()` rend au DOM ses valeurs, mais la case vit dans un état React
   *  qu'il n'atteint pas : sans cette ligne, « Annuler » laisserait le volet
   *  déplié sur une case redevenue décochée. */
  const annuler = () => {
    setTraite(values.donneesPersonnelles);
    saisie.annuler();
  };

  /**
   * `FormData` IGNORE les champs désactivés : l'empreinte relevée au premier
   * rendu, volet verrouillé, ne vaut donc rien une fois les champs réveillés. On
   * la reprend à l'ouverture — sans quoi la première frappe comparerait un
   * formulaire complet à un formulaire vide, et la coche paraîtrait d'elle-même.
   * En `useEffect` et non dans le clic : à ce moment-là, les champs portent
   * encore leur `disabled`.
   */
  useEffect(() => {
    if (!verrouille) saisie.enregistre();
  }, [verrouille, saisie.enregistre]);

  /** Refermer rend au volet ses valeurs enregistrées : le verrou ne garde pas
   *  des frappes que plus rien ne montre. C'est le geste d'« Annuler ». */
  function basculerVerrou() {
    if (!verrouille) annuler();
    setVerrouille(!verrouille);
  }

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
      const res = await updateRgpdAction(logicielId, form);
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        saisie.enregistre();
        // Le volet se referme : la modification est faite, le laisser ouvert
        // exposerait à nouveau ses cases à un clic malheureux.
        setVerrouille(true);
        router.refresh();
      }
    });
  }

  return (
    <form ref={saisie.formRef} onSubmit={submit} onChange={saisie.surSaisie} className="space-y-3">
      <Card
        title="Données personnelles"
        actions={
          readOnly ? undefined : verrouille ? (
            /* `key` distincte et `preventDefault`, comme sur les fiches : sans
               eux, ce clic ENREGISTRERAIT le volet. React réutilise le nœud
               <button> pour la coche qui prend sa place et le mute en
               `type="submit"` pendant le gestionnaire de clic. */
            <button
              key="verrou-ouvrir"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                basculerVerrou();
              }}
              disabled={pending}
              title="Modifier le volet RGPD"
              aria-label="Modifier le volet RGPD"
              className="btn-ghost !p-2 hover:!text-accent"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          ) : (
            <>
              {/* La coche attend qu'il y ait quelque chose à enregistrer, comme
                  le bouton du bas de carte. */}
              {saisie.modifie ? (
                <button
                  key="verrou-valider"
                  type="submit"
                  disabled={pending}
                  title="Enregistrer le volet RGPD"
                  aria-label="Enregistrer le volet RGPD"
                  className="btn-ghost !p-2 hover:!text-ok"
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : null}
              <button
                key="verrou-annuler"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  basculerVerrou();
                }}
                disabled={pending}
                title="Annuler la modification"
                aria-label="Annuler la modification"
                className="btn-ghost !p-2 hover:!text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )
        }
      >
        <label className="flex items-center gap-3 text-sm text-body">
          <input
            type="checkbox"
            name="donneesPersonnelles"
            checked={traite}
            onChange={(e) => setTraite(e.target.checked)}
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
          {/* Comme dans l'onglet Synthèse, la ligne suit l'état de la saisie :
              tant que rien ne diffère de l'enregistré, il n'y a rien à
              enregistrer et le seul geste qui reste est de partir. Le volet
              existe toujours — on n'entre jamais ici en création —, donc pas
              de cas où « Annuler » voudrait dire quitter. */}
          {!readOnly && saisie.modifie ? (
            <>
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button type="button" onClick={annuler} disabled={pending} className="btn-warn">
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
