"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { ChampsMarche, MARCHE_VIDE, type ValeursMarche } from "@/components/marche-champs";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
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

  /** Enregistre CE formulaire, à la demande du mode — sa part du
   *  « Enregistrer » global de la fiche. */
  async function enregistrerFormulaire(): Promise<boolean> {
    const form = saisie.formRef.current;
    if (id === undefined || !form) return true;
    if (!form.reportValidity()) return false;
    setError(null);
    const res = await updateContratFicheAction(id, new FormData(form));
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
   * Le verrou de la fiche n'est plus le sien : c'est LE mode « je modifie ce
   * marché », porté par la barre d'onglets et partagé avec les logiciels
   * couverts et les pièces. Le formulaire s'y inscrit avec ses trois
   * réponses : dire s'il porte une saisie, la rendre, l'enregistrer.
   *
   * En CRÉATION, pas de provider : `mode` est nul et tout reste ouvert.
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
   * rendu, carte verrouillée, ne vaut donc rien une fois les champs réveillés.
   * On la reprend à l'ouverture du mode — sans quoi la première frappe
   * comparerait un formulaire complet à un formulaire vide, et « Enregistrer »
   * s'allumerait de lui-même.
   */
  useEffect(() => {
    if (ouvert) saisie.enregistre();
  }, [ouvert, saisie.enregistre]);

  /** « Annuler » en CRÉATION, où il veut dire quitter : la même question, pour
   *  ce qui est le même geste — renoncer à ce qu'on a tapé. */
  async function quitterCreation() {
    if (saisie.modifie) {
      const ok = await confirmer({
        question: "Quitter sans créer le marché ?",
        detail: "La saisie en cours sera perdue.",
        action: "Quitter sans créer",
      });
      if (!ok) return;
    }
    quitter();
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
        <Card title="Marché">
          <ChampsMarche values={values} editeurs={editeurs} disabled={dis} />
        </Card>
      </form>

      {children}

      {error ? <p className="alert-error">{error}</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          {/* La ligne suit l'état du MODE, et non l'écart à l'enregistré.

              Fiche fermée : il n'y a rien à enregistrer, et le seul geste qui
              reste est de partir — « Quitter », en clair, puisqu'il ne décide de
              rien. Le crayon de la barre d'onglets l'ouvre, et « Enregistrer »
              et « Annuler » paraissent AUSSITÔT : ce sont les deux seules issues
              de la modification qu'on vient d'ouvrir.

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
                title="Revenir à la liste des contrats et marchés"
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
                      ? "Créer le marché"
                      : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={id === undefined ? quitterCreation : () => void mode?.annulerTout()}
                  disabled={pending || mode?.occupe}
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
