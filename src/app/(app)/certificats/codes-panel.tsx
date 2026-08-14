"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { Card, Field } from "@/components/ui";
import { lireCodesAction, updateCodesAction } from "./actions";

type Codes = { codeRevocation: string; codeRetrait: string };

/**
 * Les deux codes remis par l'autorité — révocation et retrait.
 *
 * Ils ne sont PAS rendus avec la page : tant que personne ne clique sur
 * « Afficher », ils ne quittent pas la base. Un secret qu'on n'a pas envoyé ne
 * traîne ni dans le HTML d'un onglet resté ouvert derrière un écran non
 * verrouillé, ni dans le cache du navigateur, ni dans une capture d'écran de
 * l'inspecteur. Le clic les demande, le bouton les remballe.
 *
 * « Afficher » reste HORS du mode de la fiche : lire un code — pour révoquer,
 * pour retirer — est une consultation, et c'est le cas courant. Les MODIFIER
 * passe par le crayon, comme tout le reste de la fiche : champs figés et
 * enregistrement absent tant que le mode est fermé.
 *
 * Champs CONTRÔLÉS, seuls de la fiche : le panneau doit savoir dire au mode
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
  const [saved, setSaved] = useState(false);
  /** null = jamais demandés — l'état « fermé », qui est celui du chargement. */
  const [codes, setCodes] = useState<Codes | null>(null);
  /** Ce que l'écran montre — s'écarte de `codes` au fil de la frappe. */
  const [saisie, setSaisie] = useState<Codes | null>(null);

  /** Masquer OUBLIE les valeurs, frappes comprises : les garder en mémoire
   *  annulerait le geste. */
  function masquer() {
    setCodes(null);
    setSaisie(null);
    setSaved(false);
    setError(null);
  }

  /** Enregistre les codes affichés, à la demande du mode ou du bouton local. */
  async function enregistrerCodes(): Promise<boolean> {
    if (saisie === null) return true;
    setError(null);
    const form = new FormData();
    form.set("codeRevocation", saisie.codeRevocation);
    form.set("codeRetrait", saisie.codeRetrait);
    const res = await updateCodesAction(id, form);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setSaved(true);
    // Ce qui est à l'écran fait désormais référence.
    setCodes(saisie);
    return true;
  }

  const mode = useInscriptionModeFiche({
    // Une frappe non enregistrée pèse dans la question du crayon.
    sale: () =>
      codes !== null &&
      saisie !== null &&
      (saisie.codeRevocation !== codes.codeRevocation || saisie.codeRetrait !== codes.codeRetrait),
    // « Rendre » remballe : montrer des frappes abandonnées comme si elles
    // étaient les codes serait pire que de devoir recliquer « Afficher ».
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
      const recus = { codeRevocation: res.codeRevocation, codeRetrait: res.codeRetrait };
      setCodes(recus);
      setSaisie(recus);
    });
  }

  /** Le bouton local « Enregistrer les codes » : leur enregistrement seul,
   *  puis le mode se referme si plus rien n'est en cours ailleurs. */
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      if (await enregistrerCodes()) {
        mode?.fermerSiPropre();
        router.refresh();
      }
    });
  }

  return (
    <Card
      title="Codes de l'autorité"
      hint="Réservés aux administrateurs"
      actions={
        codes === null ? (
          <button
            type="button"
            onClick={afficher}
            disabled={pending}
            className="btn-secondary !px-2.5"
            title="Afficher les codes de révocation et de retrait"
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
            title="Masquer les codes"
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
          de départ du titulaire ; le code de <strong>retrait</strong> sert à le récupérer et
          l'activer. Ils restent en base tant qu'on ne les demande pas.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
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
            <Field label="Code de retrait" htmlFor="codeRetrait">
              <input
                id="codeRetrait"
                name="codeRetrait"
                value={saisie.codeRetrait}
                onChange={(e) => setSaisie({ ...saisie, codeRetrait: e.target.value })}
                disabled={pending || fige}
                autoComplete="off"
                spellCheck={false}
                className="input font-mono"
              />
            </Field>
          </div>
          {/* L'enregistrement n'est offert que le mode ouvert : les codes se
              LISENT sans crayon, ils ne se corrigent pas sans lui. */}
          {fige ? null : (
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : "Enregistrer les codes"}
              </button>
              {saved ? (
                <span
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: "var(--color-ok-text)" }}
                >
                  <Check className="h-4 w-4" />
                  Codes enregistrés.
                </span>
              ) : null}
            </div>
          )}
        </form>
      )}
      {error ? <p className="alert-error mt-2">{error}</p> : null}
    </Card>
  );
}
