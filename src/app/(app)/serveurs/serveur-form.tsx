"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import { LIBELLES_TYPE_OS, TYPES_OS } from "@/schemas/serveur";
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
 * Fiche serveur — une carte, PAS D'ONGLETS ni de crayon.
 *
 * Les fiches à onglets (logiciel, éditeur, marché, certificat) tiennent leur
 * verrou d'un « mode fiche » dont le crayon vit au bout de la barre d'onglets.
 * Ici il n'y a pas de barre où le poser, et rien à protéger : la fiche tient
 * dans un écran, et « Annuler » rend la saisie d'un geste. Elle s'ouvre donc
 * modifiable, comme les écrans de création.
 *
 * `id` absent = création (redirige vers la fiche créée). Le lecteur reçoit
 * `readOnly` : champs désactivés, aucun bouton — la protection réelle reste
 * dans les server actions (requireRole admin).
 */
export function ServeurForm({
  id,
  values = VIDE,
  readOnly = false,
  nbCertificats = 0,
  logiciels,
}: {
  id?: number;
  values?: ServeurValues;
  readOnly?: boolean;
  /**
   * Les certificats que ce serveur équipe. Ils n'empêchent pas la suppression —
   * leur rattachement est en SetNull, le certificat survit à la machine — mais
   * la confirmation doit le dire avant qu'on les délie sans le vouloir.
   */
  nbCertificats?: number;
  /** La carte des logiciels installés, rendue côté serveur. */
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

  /** La confirmation s'efface d'elle-même : elle annonce un fait accompli, pas
   *  un état à surveiller. */
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
        id === undefined ? await createServeurAction(form) : await updateServeurAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
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

  const dis = readOnly || pending;

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
          <Field label="Localisation" htmlFor="localisation">
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
   * « Enregistrer » ne paraît que s'il y a quelque chose à enregistrer : tant
   * que la fiche est telle que le serveur l'a rendue, le seul geste qui reste
   * est de partir. En CRÉATION, il est toujours là — la fiche n'existe pas
   * encore, il n'y a rien à comparer.
   */
  const ligneActions = readOnly ? null : (
    <>
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {id !== undefined && !saisie.modifie ? (
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
              <button type="submit" form={FORM_ID} disabled={pending} className="btn-primary">
                {pending
                  ? "Enregistrement…"
                  : id === undefined
                    ? "Créer le serveur"
                    : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={id === undefined ? quitterCreation : saisie.annuler}
                disabled={pending}
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
      {/* Les installations s'ajoutent depuis la fiche du LOGICIEL, onglet
          Liaisons : la carte est ici en lecture, hors du flux de saisie mais
          dans le <form> — elle ne porte aucun champ nommé, elle n'envoie rien. */}
      {logiciels}
      {ligneActions}
    </form>
  );
}
