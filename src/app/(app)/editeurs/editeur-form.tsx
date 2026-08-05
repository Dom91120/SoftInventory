"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { createEditeurAction, deleteEditeurAction, updateEditeurAction } from "./actions";

export type EditeurValues = {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siteWeb: string;
  supportUrl: string;
  supportEmail: string;
  supportTelephone: string;
  supportHoraires: string;
  commercialContact: string;
  commercialTelephone: string;
  commercialEmail: string;
  adminContact: string;
  adminTelephone: string;
  adminEmail: string;
  notes: string;
};

const VIDE: EditeurValues = {
  nom: "",
  adresse: "",
  codePostal: "",
  ville: "",
  telephone: "",
  email: "",
  siteWeb: "",
  supportUrl: "",
  supportEmail: "",
  supportTelephone: "",
  supportHoraires: "",
  commercialContact: "",
  commercialTelephone: "",
  commercialEmail: "",
  adminContact: "",
  adminTelephone: "",
  adminEmail: "",
  notes: "",
};

/** Cible du bouton d'enregistrement, qui vit HORS du <form> — voir `children`. */
const FORM_ID = "editeur-form";

/**
 * Formulaire de fiche éditeur, en deux cartes : la société (coordonnées et
 * observations) puis ses contacts (assistance, commercial, administratif).
 * `id` absent = création (redirige vers la fiche créée). Le lecteur reçoit
 * `readOnly` : champs désactivés, aucun bouton — la protection réelle reste
 * dans les server actions (requireRole admin).
 */
export function EditeurForm({
  id,
  values = VIDE,
  nbPiecesJointes = 0,
  readOnly = false,
  children,
}: {
  id?: number;
  values?: EditeurValues;
  /**
   * Pièces jointes de la fiche. Tant qu'il y en a, le bouton Supprimer reste
   * grisé : la cascade PostgreSQL effacerait les lignes `documents` sans
   * retirer les fichiers du disque. L'action serveur applique la même règle.
   */
  nbPiecesJointes?: number;
  readOnly?: boolean;
  /**
   * Le reste de la fiche (logiciels rattachés, pièces jointes), posé ENTRE les
   * cartes de saisie et la ligne d'actions : Enregistrer et Supprimer closent
   * la page, pas seulement le formulaire.
   *
   * Rendu hors du <form> — le panneau de documents porte ses propres champs, et
   * une touche Entrée y déclencherait l'enregistrement de la fiche. D'où
   * l'attribut `form` sur le bouton de soumission, qui le rattache au
   * formulaire sans être dedans.
   */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        id === undefined ? await createEditeurAction(form) : await updateEditeurAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/editeurs/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function supprimer() {
    if (id === undefined) return;
    if (!window.confirm(`Supprimer l'éditeur « ${values.nom} » ?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteEditeurAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/editeurs");
      router.refresh();
    });
  }

  const dis = readOnly || pending;
  /**
   * `placeholder` plutôt que `hint` quand l'aide n'est qu'un exemple de format :
   * elle occupe alors la place du champ vide au lieu d'ajouter une ligne sous
   * chacun, ce qui allonge la fiche entière. `hint` reste pour ce qui doit se
   * lire même une fois le champ rempli.
   */
  const champ = (
    name: keyof EditeurValues,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string },
  ) => (
    <Field label={label} htmlFor={name} hint={opts?.hint}>
      <input
        id={name}
        name={name}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        defaultValue={values[name]}
        disabled={dis}
        className="input"
      />
    </Field>
  );

  return (
    <div className="space-y-3">
      <form id={FORM_ID} onSubmit={submit} className="space-y-3">
        <Card title="Coordonnées">
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <Field label="Nom de l'éditeur" htmlFor="nom" required>
              <input
                id="nom"
                name="nom"
                defaultValue={values.nom}
                required
                disabled={dis}
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
              <Field label="Observations" htmlFor="notes">
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={values.notes}
                  disabled={dis}
                  rows={3}
                  className="input"
                  placeholder="Informations libres : interlocuteurs, historique, particularités du contrat…"
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Tous les interlocuteurs de l'éditeur dans une seule carte, une ligne
            de trois tiers par interlocuteur : l'assistance, puis ses horaires
            en pleine largeur — une plage se lit d'un trait —, puis le
            commercial et l'administratif, chacun sur son rang « qui, son
            numéro, son adresse ». L'onglet Contacts du logiciel reprend cette
            grille.

            `items-end` : au tiers de largeur, « Téléphone administratif »
            passe sur deux lignes là où « Mail » tient sur une. Aligner les
            cellules par le BAS garde les champs sur la même ligne, quel que
            soit le nombre de lignes du libellé. */}
        <Card title="Contacts">
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
            {champ("supportUrl", "Portail de tickets", { type: "url", placeholder: "https://…" })}
            {champ("supportEmail", "E-mail du support", { type: "email" })}
            {champ("supportTelephone", "Téléphone du support", { type: "tel" })}
            <div className="sm:col-span-3">
              {champ("supportHoraires", "Horaires du support", {
                placeholder: "Ex. lun-ven 9h-18h",
              })}
            </div>
            {champ("commercialContact", "Contact commercial")}
            {champ("commercialTelephone", "Téléphone commercial", { type: "tel" })}
            {champ("commercialEmail", "Mail commercial", { type: "email" })}
            {champ("adminContact", "Contact administratif")}
            {champ("adminTelephone", "Téléphone administratif", { type: "tel" })}
            {champ("adminEmail", "Mail administratif", { type: "email" })}
          </div>
        </Card>
      </form>

      {children}

      {error ? <p className="alert-error">{error}</p> : null}
      {saved ? <p className="alert-success">Fiche enregistrée.</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          <button type="submit" form={FORM_ID} disabled={pending} className="btn-primary">
            {pending ? "Enregistrement…" : id === undefined ? "Créer l'éditeur" : "Enregistrer"}
          </button>
          {id !== undefined ? (
            <button
              type="button"
              onClick={supprimer}
              disabled={pending || nbPiecesJointes > 0}
              title={
                nbPiecesJointes > 0
                  ? `Suppression impossible : ${nbPiecesJointes === 1 ? "1 pièce jointe" : `${nbPiecesJointes} pièces jointes`} sur cette fiche, à retirer d'abord.`
                  : undefined
              }
              className="btn-danger"
            >
              Supprimer
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
