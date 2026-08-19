"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { Card, Field } from "@/components/ui";
import { lireCodesAction, updateCodesAction } from "./actions";

type Codes = { codeRevocation: string };

/**
 * Le code de révocation remis par l'autorité.
 *
 * Il n'est PAS rendu avec la page : tant que personne ne clique sur
 * « Afficher », il ne quitte pas la base. Un secret qu'on n'a pas envoyé ne
 * traîne ni dans le HTML d'un onglet resté ouvert derrière un écran non
 * verrouillé, ni dans le cache du navigateur, ni dans une capture d'écran de
 * l'inspecteur. Le clic le demande, le bouton le remballe.
 *
 * « Afficher » reste HORS du mode de la fiche : lire le code — pour révoquer —
 * est une consultation, et c'est le cas courant. Le MODIFIER passe par le
 * crayon, comme tout le reste de la fiche : champ figé et enregistrement
 * absent tant que le mode est fermé.
 *
 * Champ CONTRÔLÉ, seul de la fiche : le panneau doit savoir dire au mode
 * qu'une frappe est en cours — la question du crayon en dépend — et des champs
 * non contrôlés ne savent pas se comparer à ce qui est enregistré sans
 * formulaire autour.
 *
 * Cette carte n'est rendue qu'aux admins, et l'action qu'elle appelle exige à
 * nouveau ce rôle : la garde vaut côté serveur, l'absence de carte n'étant
 * qu'une commodité d'affichage.
 */
export function CodesPanel({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** null = jamais demandés — l'état « fermé », qui est celui du chargement. */
  const [codes, setCodes] = useState<Codes | null>(null);
  /** Ce que l'écran montre — s'écarte de `codes` au fil de la frappe. */
  const [saisie, setSaisie] = useState<Codes | null>(null);

  /** Masquer OUBLIE les valeurs, frappes comprises : les garder en mémoire
   *  annulerait le geste. */
  function masquer() {
    setCodes(null);
    setSaisie(null);
    setError(null);
  }

  /** Enregistre le code affiché — la part du « Enregistrer » global de la fiche. */
  async function enregistrerCodes(): Promise<boolean> {
    if (saisie === null) return true;
    setError(null);
    const form = new FormData();
    form.set("codeRevocation", saisie.codeRevocation);
    const res = await updateCodesAction(id, form);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    // Ce qui est à l'écran fait désormais référence.
    setCodes(saisie);
    return true;
  }

  const mode = useInscriptionModeFiche({
    // Une frappe non enregistrée pèse dans la question du crayon.
    sale: () => codes !== null && saisie !== null && saisie.codeRevocation !== codes.codeRevocation,
    // « Rendre » remballe : montrer une frappe abandonnée comme si elle
    // était le code serait pire que de devoir recliquer « Afficher ».
    rendre: masquer,
    // Sa part du « Enregistrer » global de la fiche.
    enregistrer: enregistrerCodes,
  });
  const fige = !(mode ? mode.actif : true);

  function afficher() {
    setError(null);
    startTransition(async () => {
      const res = await lireCodesAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const recus = { codeRevocation: res.codeRevocation };
      setCodes(recus);
      setSaisie(recus);
    });
  }

  /** Entrée dans le champ : le même enregistrement que le « Enregistrer »
   *  global du bas — qui est LE bouton, le panneau n'en a plus en propre —,
   *  puis le mode se referme si plus rien n'est en cours ailleurs. */
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      if (await enregistrerCodes()) {
        mode?.fermerSiPropre();
        router.refresh();
      }
    });
  }

  return (
    <Card
      title="Code de l'autorité"
      hint="Réservé aux administrateurs"
      actions={
        codes === null ? (
          <button
            type="button"
            onClick={afficher}
            disabled={pending}
            className="btn-secondary !px-2.5"
            title="Afficher le code de révocation"
          >
            <Eye className="h-4 w-4" />
            Afficher
          </button>
        ) : (
          <button
            type="button"
            onClick={masquer}
            disabled={pending}
            className="btn-secondary !px-2.5"
            title="Masquer le code"
          >
            <EyeOff className="h-4 w-4" />
            Masquer
          </button>
        )
      }
    >
      {codes === null || saisie === null ? (
        <p className="text-sm text-faint">
          Le code de <strong>révocation</strong> invalide le certificat en cas de perte, de vol ou
          de départ du titulaire. Il reste en base tant qu'on ne le demande pas.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          {/* Le gabarit deux colonnes reste : le champ garde la largeur qu'il
              avait quand le code de retrait occupait l'autre moitié. */}
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-2">
            <Field label="Code de révocation" htmlFor="codeRevocation">
              <input
                id="codeRevocation"
                name="codeRevocation"
                value={saisie.codeRevocation}
                onChange={(e) => setSaisie({ ...saisie, codeRevocation: e.target.value })}
                disabled={pending || fige}
                autoComplete="off"
                spellCheck={false}
                className="input font-mono"
              />
            </Field>
          </div>
          {/* Pas de bouton propre : l'enregistrement passe par le
              « Enregistrer » de la fiche, en bas — un second bouton ici
              faisait double emploi. Entrée dans le champ fait de même. */}
        </form>
      )}
      {error ? <p className="alert-error mt-2">{error}</p> : null}
    </Card>
  );
}
