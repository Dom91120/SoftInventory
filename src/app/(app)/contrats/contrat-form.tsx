"use client";

import { Check, SquarePen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { ChampsMarche, MARCHE_VIDE, type ValeursMarche } from "@/components/marche-champs";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card } from "@/components/ui";
import {
  createContratFicheAction,
  deleteContratFicheAction,
  updateContratFicheAction,
} from "./actions";

/** Les champs eux-mêmes vivent dans `ChampsMarche`, partagé avec l'onglet du logiciel. */
export type ContratValues = ValeursMarche;

/** Cible du bouton d'enregistrement, qui vit hors du <form> — voir `children`. */
const FORM_ID = "contrat-form";

/**
 * Fiche d'un marché : ses données propres, et elles seules. Les logiciels
 * couverts se rattachent au clic, dans leur propre carte (`children`), hors de
 * ce formulaire — un lien n'est pas un champ.
 *
 * `id` absent = création (redirige vers la fiche créée, où l'on rattache). Le
 * lecteur reçoit `readOnly` : champs désactivés, aucun bouton — la protection
 * réelle reste dans les server actions (requireRole admin).
 */
export function ContratForm({
  id,
  values = MARCHE_VIDE,
  editeurs,
  readOnly = false,
  children,
}: {
  id?: number;
  values?: ContratValues;
  /** Annuaire des sociétés, pour désigner le fournisseur. */
  editeurs: Array<{ id: number; nom: string }>;
  readOnly?: boolean;
  /** Logiciels couverts et pièces, entre le formulaire et la ligne d'actions. */
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
  const quitter = () => router.push("/contrats");

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
        id === undefined
          ? await createContratFicheAction(form)
          : await updateContratFicheAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/contrats/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        saisie.enregistre();
        // La carte se referme : la modification est faite, la laisser ouverte
        // exposerait à nouveau les champs à une molette égarée. Le crayon la
        // rouvre en un clic pour qui n'a pas fini.
        setVerrouille(true);
        router.refresh();
      }
    });
  }

  async function supprimer() {
    if (id === undefined) return;
    const ok = await confirmer({
      question: "Supprimer ce marché ?",
      detail:
        "Ses pièces et leurs fichiers seront supprimés aussi. Les logiciels couverts, eux, ne sont pas touchés.",
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContratFicheAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/contrats");
      router.refresh();
    });
  }

  /**
   * La carte s'ouvre en LECTURE sur une fiche existante : on vient bien plus
   * souvent y chercher une date de fin qu'en changer une, et un formulaire
   * d'emblée vivant se modifie d'une molette égarée sur une liste déroulante.
   * Le crayon de l'en-tête lève le verrou.
   *
   * En création, rien à protéger : la fiche n'existe pas et tout reste à saisir.
   */
  const [verrouille, setVerrouille] = useState(id !== undefined);
  const dis = readOnly || pending || verrouille;

  /**
   * `FormData` IGNORE les champs désactivés : l'empreinte relevée au premier
   * rendu, carte verrouillée, ne vaut donc rien une fois les champs réveillés.
   * On la reprend à l'ouverture du verrou — sans quoi la première frappe
   * comparerait un formulaire complet à un formulaire vide, et « Enregistrer »
   * s'allumerait de lui-même. En `useEffect` et non dans le clic : à ce
   * moment-là, les champs portent encore leur `disabled`.
   */
  useEffect(() => {
    if (!verrouille) saisie.enregistre();
  }, [verrouille, saisie.enregistre]);

  /** Refermer rend ses valeurs enregistrées au formulaire : le verrou ne garde
   *  pas des frappes que plus rien ne montre. C'est le geste d'« Annuler ». */
  function basculerVerrou() {
    if (!verrouille) saisie.annuler();
    setVerrouille(!verrouille);
  }

  return (
    <div className="space-y-3">
      <form
        id={FORM_ID}
        ref={saisie.formRef}
        onSubmit={submit}
        onChange={saisie.surSaisie}
        className="space-y-3"
      >
        <Card
          title="Marché"
          actions={
            readOnly ? undefined : verrouille ? (
              /**
               * `key` distincte et `preventDefault` : sans eux, ce clic
               * ENREGISTRAIT le marché. React réutilise le nœud <button> pour
               * la coche qui prend sa place et le mute en `type="submit"`
               * PENDANT le gestionnaire de clic — le navigateur exécute ensuite
               * l'action par défaut sur ce qu'il est devenu. La clé lui interdit
               * la réutilisation, `preventDefault` annule l'action par défaut.
               */
              <button
                key="verrou-ouvrir"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  basculerVerrou();
                }}
                disabled={pending}
                title="Modifier ce marché"
                aria-label="Modifier ce marché"
                className="btn-ghost !p-2 hover:!text-accent"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            ) : (
              /* Les deux issues de la modification prennent la place du crayon,
                 là où le geste a commencé : valider d'abord — c'est ce qu'on
                 vient faire —, renoncer ensuite. Le bouton « Enregistrer » du
                 bas de page reste, pour qui a déroulé la fiche entière.

                 La coche attend qu'il y ait quelque chose à enregistrer : même
                 règle qu'en bas de page. Offerte d'emblée, elle invitait à un
                 geste sans effet — et un enregistrement à vide touche quand
                 même la date de modification de la fiche. */
              <>
                {saisie.modifie ? (
                  <button
                    key="verrou-valider"
                    type="submit"
                    form={FORM_ID}
                    disabled={pending}
                    title="Enregistrer ce marché"
                    aria-label="Enregistrer ce marché"
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
          <ChampsMarche values={values} editeurs={editeurs} disabled={dis} />
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
                title="Revenir à la liste des contrats et marchés"
              >
                Quitter
              </button>
            ) : (
              <>
                <button type="submit" form={FORM_ID} disabled={pending} className="btn-primary">
                  {pending
                    ? "Enregistrement…"
                    : id === undefined
                      ? "Créer le marché"
                      : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={id === undefined ? quitter : saisie.annuler}
                  disabled={pending}
                  className="btn-warn"
                  title={id === undefined ? "Quitter sans créer le marché" : undefined}
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
                Marché enregistré.
              </span>
            ) : null}
          </div>
          {/* La corbeille garde son bout de ligne : elle ne porte pas sur la
              saisie en cours mais sur la fiche entière. */}
          {id === undefined ? null : (
            <button type="button" onClick={supprimer} disabled={pending} className="btn-danger">
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
