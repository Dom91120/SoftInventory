"use client";

import { useRef, useState, useTransition } from "react";
import { createServeurAction } from "@/app/(app)/serveurs/actions";
import { Card, Field } from "@/components/ui";
import { LIBELLES_TYPE_OS, TYPES_OS } from "@/schemas/serveur";

/**
 * Création d'une machine absente du parc sans quitter la saisie en cours.
 * Reprend les MÊMES champs que « Serveurs › Nouveau », dans le même ordre et
 * sous les mêmes libellés : la fiche créée ici n'est pas un brouillon à
 * compléter ailleurs. Les clés étant celles de la page serveur, la même server
 * action la valide.
 *
 * Même geste et même forme que `ModaleSociete`, qui crée un éditeur depuis la
 * fiche d'un logiciel ou d'un devis : on découvre qu'un serveur manque au
 * moment de l'associer, et aller le créer ailleurs coûterait la saisie en
 * cours.
 *
 * Pas de <form> ici : la modale s'affiche À L'INTÉRIEUR de l'écran appelant, et
 * un formulaire imbriqué est invalide en HTML. D'où les champs relus à la main
 * depuis le conteneur, la soumission au clic, et l'interception d'Entrée qui
 * validerait sinon le formulaire du dessous.
 */
export function ModaleServeur({
  onFermer,
  onCree,
}: {
  onFermer: () => void;
  onCree: (serveur: { id: number; nom: string }) => void;
}) {
  const champsRef = useRef<HTMLDivElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function creer() {
    const conteneur = champsRef.current;
    if (!conteneur) return;
    // Faute de <form>, on reconstitue le FormData depuis les champs nommés :
    // les mêmes clés que la page serveur, donc la même server action. La CASE
    // à cocher se relit par `checked` — son `value` vaut « on » qu'elle soit
    // cochée ou non, et le parc entier serait déclaré virtuel.
    const form = new FormData();
    for (const el of conteneur.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("[name]")) {
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        if (el.checked) form.set(el.name, "on");
      } else {
        form.set(el.name, el.value);
      }
    }
    const nom = String(form.get("nom") ?? "").trim();
    if (nom === "") {
      setErreur("Le nom du serveur est obligatoire.");
      return;
    }
    setErreur(null);
    startTransition(async () => {
      const res = await createServeurAction(form);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      if (res.id === undefined) {
        setErreur("Serveur créé, mais impossible de le sélectionner. Rechargez la page.");
        return;
      }
      onCree({ id: res.id, nom });
    });
  }

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
        // création — sauf dans les observations, où elle sert à aller à la ligne.
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          creer();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-serveur"
        className="my-8 w-full max-w-3xl rounded-2xl border border-line bg-surface px-5 py-4 shadow-lg"
      >
        <h3
          id="titre-serveur"
          className="mb-3 text-sm font-bold uppercase tracking-wider text-muted"
        >
          Nouveau serveur
        </h3>
        {erreur ? <p className="alert-error mb-3">{erreur}</p> : null}

        {/* La carte « Identité » de la fiche serveur, telle quelle : mêmes
            libellés, même rangée de cinq champs, même composant `Card` avec sa
            barre d'accent. La modale reprend la fiche plutôt que de la
            paraphraser. */}
        <div ref={champsRef} className="space-y-3">
          <Card title="Identité">
            <div className="grid gap-x-3 gap-y-2">
              <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-[30fr_auto_auto_24fr_23fr]">
                <Field label="Nom du serveur" htmlFor="srv-nom" required>
                  <input
                    // biome-ignore lint/a11y/noAutofocus: la modale vient d'être ouverte par un clic délibéré sur « + ».
                    autoFocus
                    id="srv-nom"
                    name="nom"
                    required
                    maxLength={120}
                    disabled={pending}
                    className="input"
                    placeholder="Ex : SRV-AFFGE"
                  />
                </Field>
                <Field label="Virtuel" htmlFor="srv-virtuel">
                  <div className="flex h-[1.85rem] items-center justify-center">
                    <input
                      id="srv-virtuel"
                      name="virtuel"
                      type="checkbox"
                      defaultChecked
                      disabled={pending}
                      className="h-4 w-4 accent-(--color-accent)"
                    />
                  </div>
                </Field>
                <Field label="Type" htmlFor="srv-typeOs">
                  <select
                    id="srv-typeOs"
                    name="typeOs"
                    defaultValue=""
                    disabled={pending}
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
                <Field label="Système" htmlFor="srv-os">
                  <input
                    id="srv-os"
                    name="os"
                    disabled={pending}
                    className="input"
                    placeholder="Ex : Windows Server 2022"
                  />
                </Field>
                <Field label="Localisation" htmlFor="srv-localisation">
                  <input
                    id="srv-localisation"
                    name="localisation"
                    disabled={pending}
                    className="input"
                    placeholder="Ex : salle serveur — mairie"
                  />
                </Field>
              </div>
              <Field label="Observations" htmlFor="srv-notes">
                <textarea
                  id="srv-notes"
                  name="notes"
                  rows={3}
                  disabled={pending}
                  className="input"
                  placeholder="Informations libres : sauvegarde, exploitant, particularités…"
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={creer}>
            {pending ? "Création…" : "Créer le serveur"}
          </button>
          <button type="button" className="btn-warn" disabled={pending} onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
