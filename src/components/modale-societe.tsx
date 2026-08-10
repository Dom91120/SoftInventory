"use client";

import { useRef, useState, useTransition } from "react";
import { createEditeurAction } from "@/app/(app)/editeurs/actions";
import { Card, Field } from "@/components/ui";

/**
 * Création d'une société absente de l'annuaire sans quitter la saisie en cours.
 * Reprend les MÊMES champs que « Éditeurs › Nouveau », dans le même ordre et
 * sous les mêmes libellés — coordonnées et observations, puis les trois rangs
 * de contacts : la fiche créée ici n'est pas un brouillon à compléter ailleurs.
 * Les clés étant celles de la page éditeur, la même server action la valide.
 *
 * PARTAGÉE par les deux écrans qui désignent une société sans pouvoir la
 * quitter : le devis d'un logiciel et la fiche du logiciel lui-même. Recopiée,
 * elle aurait divergé de la page éditeur d'un côté seulement — c'est déjà
 * arrivé aux champs d'un marché.
 *
 * Pas de <form> ici : la modale s'affiche À L'INTÉRIEUR du formulaire appelant,
 * et un formulaire imbriqué est invalide en HTML. D'où les champs relus à la
 * main depuis le conteneur, la soumission au clic, et l'interception d'Entrée
 * qui validerait sinon le formulaire du dessous.
 */
export function ModaleSociete({
  onFermer,
  onCreee,
}: {
  onFermer: () => void;
  onCreee: (societe: { id: number; nom: string }) => void;
}) {
  const champsRef = useRef<HTMLDivElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function creer() {
    const conteneur = champsRef.current;
    if (!conteneur) return;
    // Faute de <form>, on reconstitue le FormData depuis les champs nommés :
    // les mêmes clés que la page éditeur, donc la même server action.
    const form = new FormData();
    for (const el of conteneur.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[name]")) {
      form.set(el.name, el.value);
    }
    const nom = String(form.get("nom") ?? "").trim();
    if (nom === "") {
      setErreur("Le nom de l'éditeur est obligatoire.");
      return;
    }
    setErreur(null);
    startTransition(async () => {
      const res = await createEditeurAction(form);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      if (res.id === undefined) {
        setErreur("Société créée, mais impossible de la sélectionner. Rechargez la page.");
        return;
      }
      onCreee({ id: res.id, nom });
    });
  }

  // Même règle que la fiche éditeur : un simple exemple de format part en
  // `placeholder`, qui n'ajoute pas de ligne sous le champ.
  const champ = (
    name: string,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string; id?: string },
  ) => {
    const id = opts?.id ?? `soc-${name}`;
    return (
      <Field label={label} htmlFor={id} hint={opts?.hint}>
        <input
          id={id}
          name={name}
          type={opts?.type ?? "text"}
          placeholder={opts?.placeholder}
          disabled={pending}
          className="input"
        />
      </Field>
    );
  };

  // Sans libellé, pour la ligne qui prolonge celle du dessus — voir la fiche
  // éditeur, dont c'est la grille. `aria-label` porte le nom que la position
  // dit à l'œil.
  const champNu = (name: string, label: string, opts?: { type?: string }) => (
    <input
      id={`soc-${name}`}
      name={name}
      type={opts?.type ?? "text"}
      aria-label={label}
      disabled={pending}
      className="input"
    />
  );

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
        // création — sauf dans les notes, où elle sert à aller à la ligne.
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          creer();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-societe"
        className="my-8 w-full max-w-3xl rounded-2xl border border-line bg-surface px-5 py-4 shadow-lg"
      >
        <h3
          id="titre-societe"
          className="mb-3 text-sm font-bold uppercase tracking-wider text-muted"
        >
          Nouvel éditeur
        </h3>
        {erreur ? <p className="alert-error mb-3">{erreur}</p> : null}

        {/* Les deux cartes de « Éditeurs › Nouveau », telles quelles : mêmes
            libellés, même grille, et le même composant `Card` avec sa barre
            d'accent. La modale reprend la fiche plutôt que de la paraphraser —
            ce qui se saisit ici est une fiche éditeur entière, pas un brouillon
            à compléter ailleurs. */}
        <div ref={champsRef} className="space-y-3">
          <Card title="Coordonnées">
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              <Field label="Nom de l'éditeur" htmlFor="soc-nom" required>
                <input
                  // biome-ignore lint/a11y/noAutofocus: la modale vient d'être ouverte par un clic délibéré sur « + ».
                  autoFocus
                  id="soc-nom"
                  name="nom"
                  required
                  maxLength={150}
                  disabled={pending}
                  className="input"
                />
              </Field>
              {champ("siteWeb", "Site web", { type: "url", placeholder: "https://…" })}
              {champ("adresse", "Adresse")}
              <div className="grid grid-cols-[8rem_1fr] gap-4">
                {champ("codePostal", "Code postal")}
                {champ("ville", "Ville")}
              </div>
              {champ("telephone", "Téléphone standard", { type: "tel" })}
              {champ("email", "E-mail", { type: "email" })}
              {/* Pleine largeur : c'est de la prose, elle ne se lit pas en
                  colonne de 8 rem comme un code postal. */}
              <div className="sm:col-span-2">
                <Field label="Observations" htmlFor="soc-notes">
                  <textarea
                    id="soc-notes"
                    name="notes"
                    rows={3}
                    disabled={pending}
                    className="input"
                    placeholder="Informations libres : interlocuteurs, historique, particularités du contrat…"
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* `items-end`, comme sur la fiche : au tiers de largeur, « Téléphone
              administratif » passe sur deux lignes là où « Mail » tient sur une,
              et aligner par le bas garde les champs sur la même ligne. */}
          <Card title="Contacts">
            <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
              {/* Sixièmes 2/1/1/2, comme sur la fiche : deux adresses larges
                  encadrant deux numéros courts. */}
              <div
                className="grid items-end gap-x-3 gap-y-2 sm:col-span-3"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr" }}
              >
                {champ("supportUrl", "Portail de tickets", {
                  type: "url",
                  placeholder: "https://…",
                })}
                {champ("supportTelephone", "Tél du support", { type: "tel" })}
                {champ("numeroClient", "N° de client")}
                {champ("supportEmail", "Mail du support", { type: "email" })}
              </div>
              {/* Deux lignes, comme sur la fiche : la semaine, puis le jour qui
                  en sort. La seconde reste vide quand il n'y en a pas. */}
              <div className="grid items-end gap-x-3 gap-y-2 sm:col-span-3 sm:grid-cols-2">
                {champ("supportHoraires", "Horaires du support", {
                  placeholder: "Ex. lundi au vendredi 8h-17h",
                })}
                {champ("supportHoraires2", "Horaires du support (2ᵉ ligne)", {
                  placeholder: "Ex. samedi 8h-12h",
                })}
              </div>
              {champ("commercialContact", "Contact commercial")}
              {champ("commercialTelephone", "Tél commercial", { type: "tel" })}
              {champ("commercialEmail", "Mail commercial", { type: "email" })}
              {champNu("commercialContact2", "Contact commercial 2")}
              {champNu("commercialTelephone2", "Tél commercial 2", { type: "tel" })}
              {champNu("commercialEmail2", "Mail commercial 2", { type: "email" })}
              {champ("adminContact", "Contact administratif")}
              {champ("adminTelephone", "Tél administratif", { type: "tel" })}
              {champ("adminEmail", "Mail administratif", { type: "email" })}
              {champ("dpoContact", "DPO")}
              {champ("dpoTelephone", "Tél DPO", { type: "tel" })}
              {champ("dpoEmail", "Mail DPO", { type: "email" })}
            </div>
          </Card>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={creer}>
            {pending ? "Création…" : "Créer l'éditeur"}
          </button>
          <button type="button" className="btn-warn" disabled={pending} onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
