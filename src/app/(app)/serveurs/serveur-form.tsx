"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import { LIBELLES_TYPE_OS, TYPES_OS } from "@/schemas/serveur";
import { addServeurAction } from "../logiciels/actions";
import { createServeurAction, deleteServeurAction, updateServeurAction } from "./actions";

export type ServeurValues = {
  nom: string;
  virtuel: boolean;
  typeOs: string;
  os: string;
  localisation: string;
  notes: string;
};

/** Le parc est virtualisé : la machine physique est l'exception, et une
 *  création part de ce qui est vrai neuf fois sur dix. Le type de système, lui,
 *  ne se devine pas — il s'ouvre à vide. */
const VIDE: ServeurValues = {
  nom: "",
  virtuel: true,
  typeOs: "",
  os: "",
  localisation: "",
  notes: "",
};

const FORM_ID = "serveur-form";

/**
 * Fiche serveur — une carte, et LE MÊME VERROU que les cinq autres fiches :
 * elle s'ouvre en lecture, et c'est le crayon qui la rend modifiable.
 *
 * Elle n'a pas d'onglets, mais elle garde leur BARRE, réduite à son filet et à
 * l'emplacement des commandes (voir `[id]/page.tsx`) : le crayon se trouve là
 * où on l'a laissé sur les autres fiches, et le geste ne change pas d'une
 * fiche à l'autre. Sans lui, celle-ci s'ouvrait modifiable — un clic malheureux
 * dans un champ, et le parc changeait sans qu'on l'ait voulu.
 *
 * `id` absent = création (redirige vers la fiche créée) : pas de provider, donc
 * pas de verrou — une fiche qu'on est en train de saisir n'a rien à protéger.
 * Le lecteur reçoit `readOnly` : champs désactivés, aucun bouton — la protection
 * réelle reste dans les server actions (requireRole admin).
 */
export function ServeurForm({
  id,
  values = VIDE,
  readOnly = false,
  nbCertificats = 0,
  logiciels,
  installationsEnAttente = [],
}: {
  id?: number;
  values?: ServeurValues;
  readOnly?: boolean;
  /**
   * EN CRÉATION seulement : les installations déclarées avant que la machine
   * existe. Elles ne peuvent pas s'écrire plus tôt — une ligne de liaison exige
   * les deux identifiants —, alors le formulaire les pose juste après la
   * création, avant de partir vers la fiche.
   */
  installationsEnAttente?: Array<{ logicielId: number }>;
  /**
   * Les certificats que ce serveur équipe. Ils n'empêchent pas la suppression —
   * leur rattachement est en SetNull, le certificat survit à la machine — mais
   * la confirmation doit le dire avant qu'on les délie sans le vouloir.
   */
  nbCertificats?: number;
  /** La carte des logiciels installés, montée par la page. */
  logiciels?: ReactNode;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saisie = useSaisieEnCours();
  /** Retour à SA liste, et non à la page précédente : arrivé par une URL collée
   *  ou un rechargement, un retour d'historique ferait sortir de l'application. */
  const quitter = () => router.push("/serveurs");

  /**
   * Enregistre CE formulaire, à la demande du mode. La validation native passe
   * d'abord : un nom vide doit se dire ici, pas en erreur serveur.
   */
  async function enregistrerFormulaire(): Promise<boolean> {
    const form = saisie.formRef.current;
    if (id === undefined || !form) return true;
    if (!form.reportValidity()) return false;
    setError(null);
    const res = await updateServeurAction(id, new FormData(form));
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
   * Le verrou de la fiche est LE mode « je modifie cette fiche », celui des
   * autres fiches, dont le crayon vit sur la barre. Le formulaire s'y inscrit
   * avec ses trois réponses : dire s'il porte une saisie, la rendre,
   * l'enregistrer.
   *
   * En CRÉATION, pas de provider : `mode` est nul et tout reste ouvert.
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
   * rendu, fiche verrouillée, ne vaut donc rien une fois les champs réveillés.
   * On la reprend à l'ouverture du mode — sans quoi la première frappe
   * comparerait un formulaire complet à un formulaire vide.
   */
  useEffect(() => {
    if (ouvert) saisie.enregistre();
  }, [ouvert, saisie.enregistre]);

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. */
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  /**
   * Envoi du formulaire — bouton « Enregistrer » ou touche Entrée. Sur une
   * fiche EXISTANTE, il passe par le mode, qui referme le verrou une fois
   * l'enregistrement abouti. En CRÉATION, il crée.
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
        id === undefined ? await createServeurAction(form) : await updateServeurAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        // Les installations déclarées pendant la saisie se posent maintenant :
        // la machine a enfin un identifiant. EN SÉQUENCE, et un échec ARRÊTE le
        // départ vers la fiche : le serveur, lui, est bien créé, et une
        // redirection emporterait le message avec elle.
        let pose = true;
        for (const i of installationsEnAttente) {
          const lien = await addServeurAction(i.logicielId, res.id);
          if (!lien.ok) {
            setError(
              `Le serveur est créé, mais une installation n'a pas pu être déclarée : ${lien.error ?? "erreur."} Reprenez-la depuis sa fiche.`,
            );
            pose = false;
            break;
          }
        }
        if (!pose) return;
        router.replace(`/serveurs/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        saisie.enregistre();
        router.refresh();
      }
    });
  }

  /** « Annuler » veut dire quitter tant que la fiche n'existe pas : il n'y a
   *  aucune valeur enregistrée où revenir. */
  async function quitterCreation() {
    if (saisie.modifie) {
      const ok = await confirmer({
        question: "Quitter sans créer le serveur ?",
        detail: "La saisie en cours sera perdue.",
        action: "Quitter sans créer",
      });
      if (!ok) return;
    }
    quitter();
  }

  async function supprimer() {
    if (id === undefined) return;
    const ok = await confirmer({
      question: `Supprimer le serveur « ${values.nom} » ?`,
      detail:
        nbCertificats > 0
          ? nbCertificats === 1
            ? "Un certificat lui est rattaché : il sera conservé, mais ne désignera plus aucune machine."
            : `${nbCertificats} certificats lui sont rattachés : ils seront conservés, mais ne désigneront plus aucune machine.`
          : undefined,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteServeurAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/serveurs");
      router.refresh();
    });
  }

  const dis = readOnly || pending || !ouvert;

  const carteIdentite = (
    <Card title="Identité">
      {/* Ce qu'on dit d'une machine tient sur UNE ligne : son nom, si elle est
          virtuelle, sa famille de système, sa version exacte, où elle se trouve.
          La case à cocher et la liste des types prennent `auto` — leur largeur
          MINIMALE, celle de leur libellé et de leur plus longue option : elles
          n'ont rien à gagner à s'étirer. Ce qui reste se partage en parts
          inégales — 30 / 24 / 23 — parce qu'un nom de machine, une version de
          système et un lieu n'ont pas la même longueur.

          `fr` et non `%` : la grille pose quatre gouttières de 12 px, et des
          pourcentages faisant 100 déborderaient d'autant. `items-end` aligne les
          champs par le BAS — c'est là que se pose la case à cocher, plus courte
          que les champs qu'elle voisine. */}
      <div className="grid gap-x-3 gap-y-2">
        <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-[30fr_auto_auto_24fr_23fr]">
          <Field label="Nom du serveur" htmlFor="nom" required>
            <input
              id="nom"
              name="nom"
              defaultValue={values.nom}
              required
              disabled={dis}
              className="input"
              placeholder="Ex : SRV-AFFGE"
            />
          </Field>
          {/* La hauteur est POSÉE à celle EXACTE d'un `.input` — 1,85 rem, le
              même nombre que le bouton « + » de la fiche logiciel. Sans elle, la
              case seule ferait une rangée plus courte et se collerait au bas de
              la ligne ; à 30 px ronds elle la dépassait de 0,4 px, et comme la
              rangée s'aligne par le BAS, c'est le libellé « VIRTUEL » qui
              montait d'un pixel au-dessus de ses voisins.
              La case se CENTRE sous son libellé : seule de sa colonne, dont
              « VIRTUEL » fixe la largeur, elle pendait au bord gauche. */}
          <Field label="Virtuel" htmlFor="virtuel">
            <div className="flex h-[1.85rem] items-center justify-center">
              <input
                id="virtuel"
                name="virtuel"
                type="checkbox"
                defaultChecked={values.virtuel}
                disabled={dis}
                className="h-4 w-4 accent-(--color-accent)"
              />
            </div>
          </Field>
          {/* La FAMILLE du système, celle qui décide des outils d'administration.
              Sa version exacte se saisit juste à côté, en clair. Le vide est une
              réponse : on ne sait pas toujours, et rien n'oblige à trancher. */}
          <Field label="Type" htmlFor="typeOs">
            <select
              id="typeOs"
              name="typeOs"
              defaultValue={values.typeOs}
              disabled={dis}
              // `!w-auto` : une liste de trois choix courts n'a pas besoin d'une
              // colonne, elle prend la largeur de sa plus longue option. Le
              // `w-full` d'`.input` est fait pour les champs de saisie, où l'on
              // ne sait pas d'avance ce qui sera tapé.
              className="input !w-auto"
            >
              <option value="">— inconnu —</option>
              {TYPES_OS.map((cle) => (
                <option key={cle} value={cle}>
                  {LIBELLES_TYPE_OS[cle]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Système" htmlFor="os">
            <input
              id="os"
              name="os"
              defaultValue={values.os}
              disabled={dis}
              className="input"
              placeholder="Ex : Windows Server 2022"
            />
          </Field>
          <Field label="Emplacement" htmlFor="localisation">
            <input
              id="localisation"
              name="localisation"
              defaultValue={values.localisation}
              disabled={dis}
              className="input"
              placeholder="Ex : salle serveur — mairie"
            />
          </Field>
        </div>
        {/* Pleine largeur : c'est de la prose, elle ne se lit pas en colonne. */}
        <Field label="Observations" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            defaultValue={values.notes}
            disabled={dis}
            rows={3}
            className="input"
            placeholder="Informations libres : sauvegarde, exploitant, particularités…"
          />
        </Field>
      </div>
    </Card>
  );

  /**
   * La ligne suit l'état du MODE, comme sur les autres fiches.
   *
   * Fiche fermée : il n'y a rien à enregistrer, et le seul geste qui reste est
   * de partir — « Quitter », en clair, puisqu'il ne décide de rien. Le crayon
   * ouvre le mode, et « Enregistrer » et « Annuler » paraissent AUSSITÔT : ce
   * sont les issues de la modification qu'on vient d'ouvrir.
   *
   * En CRÉATION, la fiche n'existe pas encore : rien à retrouver, donc
   * « Annuler » y veut dire quitter, et il est toujours offert.
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
              title="Revenir à la liste des serveurs"
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
                    ? "Créer le serveur"
                    : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={id === undefined ? quitterCreation : () => void mode?.annulerTout()}
                disabled={pending || mode?.occupe}
                className="btn-warn"
                title={id === undefined ? "Quitter sans créer le serveur" : undefined}
              >
                Annuler
              </button>
            </>
          )}
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
        {id === undefined ? null : (
          <button type="button" onClick={supprimer} disabled={pending} className="btn-danger">
            Supprimer
          </button>
        )}
      </div>
    </>
  );

  return (
    <form
      id={FORM_ID}
      ref={saisie.formRef}
      onSubmit={submit}
      onChange={saisie.surSaisie}
      className="space-y-3"
    >
      {carteIdentite}
      {/* La carte des installations vit DANS le <form> sans en faire partie :
          elle ne porte aucun champ nommé, elle n'envoie rien, et ses gestes
          s'appliquent au clic. Elle tient sa part du mode de la fiche pour son
          propre compte (voir `[id]/logiciels-panel.tsx`). */}
      {logiciels}
      {ligneActions}
    </form>
  );
}
