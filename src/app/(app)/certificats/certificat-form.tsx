"use client";

import { Check, SquarePen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useConfirmation } from "@/components/confirmation";
import { useSaisieEnCours } from "@/components/saisie-en-cours";
import { Card, Field } from "@/components/ui";
import {
  LIBELLES_CERTIFICAT,
  STATUTS_CERTIFICAT,
  SUPPORTS_CERTIFICAT,
  USAGES_CERTIFICAT,
} from "@/schemas/certificat";
import { createCertificatAction, deleteCertificatAction, updateCertificatAction } from "./actions";

/** Le formulaire est NON CONTRÔLÉ : des chaînes, que le DOM rend au `reset()`. */
export type CertificatValues = {
  titulaire: string;
  fonction: string;
  email: string;
  fournisseurId: string;
  serviceId: string;
  serveurId: string;
  usage: string;
  support: string;
  niveau: string;
  numeroSerie: string;
  dateDebut: string;
  dateFin: string;
  dureeAnnees: string;
  montantTtc: string;
  imputation: string;
  bonCommandeLe: string;
  bonCommandeNote: string;
  statut: string;
  notes: string;
};

export const CERTIFICAT_VIDE: CertificatValues = {
  titulaire: "",
  fonction: "",
  email: "",
  fournisseurId: "",
  serviceId: "",
  serveurId: "",
  usage: "",
  support: "",
  niveau: "",
  numeroSerie: "",
  dateDebut: "",
  dateFin: "",
  dureeAnnees: "",
  montantTtc: "",
  imputation: "",
  bonCommandeLe: "",
  bonCommandeNote: "",
  statut: "actif",
  notes: "",
};

/** Cible du bouton d'enregistrement, qui vit hors du <form>. */
const FORM_ID = "certificat-form";

type Option = { id: number; nom: string };

/**
 * Fiche d'un certificat électronique.
 *
 * `id` absent = création (redirige vers la fiche créée). Le lecteur reçoit
 * `readOnly` : champs désactivés, aucun bouton — la protection réelle reste
 * dans les server actions (requireRole admin).
 *
 * `children` reçoit la carte des codes de l'autorité, qui n'est rendue qu'aux
 * admins et vit hors de ce formulaire : elle a sa propre écriture, pour qu'un
 * enregistrement de la fiche ne puisse jamais effacer les codes par omission.
 */
export function CertificatForm({
  id,
  values = CERTIFICAT_VIDE,
  editeurs,
  services,
  serveurs,
  readOnly = false,
  children,
}: {
  id?: number;
  values?: CertificatValues;
  /** Annuaire des sociétés : c'est là que vivent les autorités de certification. */
  editeurs: Option[];
  services: Option[];
  serveurs: Option[];
  readOnly?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saisie = useSaisieEnCours();
  const quitter = () => router.push("/certificats");

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  /**
   * La carte s'ouvre en LECTURE sur une fiche existante : on vient bien plus
   * souvent y chercher une date d'expiration qu'en changer une. Le crayon de
   * l'en-tête lève le verrou. En création, rien à protéger.
   */
  const [verrouille, setVerrouille] = useState(id !== undefined);
  const dis = readOnly || pending || verrouille;

  useEffect(() => {
    if (!verrouille) saisie.enregistre();
  }, [verrouille, saisie.enregistre]);

  function basculerVerrou() {
    if (!verrouille) saisie.annuler();
    setVerrouille(!verrouille);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        id === undefined
          ? await createCertificatAction(form)
          : await updateCertificatAction(id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (id === undefined && res.id) {
        router.replace(`/certificats/${res.id}`);
        router.refresh();
      } else {
        setSaved(true);
        saisie.enregistre();
        setVerrouille(true);
        router.refresh();
      }
    });
  }

  async function supprimer() {
    if (id === undefined) return;
    const ok = await confirmer({
      question: "Supprimer ce certificat ?",
      detail:
        "La fiche et les codes de l'autorité qu'elle porte seront perdus. Le certificat lui-même, chez l'autorité, n'est pas révoqué pour autant.",
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCertificatAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/certificats");
      router.refresh();
    });
  }

  /** Liste déroulante d'un rattachement facultatif — « — » y est une réponse. */
  const selectOption = (
    name: keyof CertificatValues,
    label: string,
    options: Option[],
    vide: string,
  ) => (
    <Field label={label} htmlFor={name}>
      <select id={name} name={name} defaultValue={values[name]} disabled={dis} className="input">
        <option value="">{vide}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom}
          </option>
        ))}
      </select>
    </Field>
  );

  const commandes = readOnly ? undefined : verrouille ? (
    <button
      key="verrou-ouvrir"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        basculerVerrou();
      }}
      disabled={pending}
      title="Modifier ce certificat"
      aria-label="Modifier ce certificat"
      className="btn-ghost !p-2 hover:!text-accent"
    >
      <SquarePen className="h-4 w-4" />
    </button>
  ) : (
    <>
      {saisie.modifie ? (
        <button
          key="verrou-valider"
          type="submit"
          form={FORM_ID}
          disabled={pending}
          title="Enregistrer ce certificat"
          aria-label="Enregistrer ce certificat"
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
  );

  return (
    <div className="space-y-3">
      <form
        id={FORM_ID}
        ref={saisie.formRef}
        onSubmit={submit}
        onChange={saisie.surSaisie}
        className="space-y-3"
      >
        {/* Qui le porte. Les commandes de la fiche entière se posent sur cette
            carte-ci, la première : c'est d'elle qu'on ouvre la modification. */}
        <Card title="Titulaire" actions={commandes}>
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
            <Field label="Titulaire" htmlFor="titulaire" required>
              <input
                id="titulaire"
                name="titulaire"
                required
                placeholder="Ex : Mme AZZAZ, SRV-CHORUS"
                defaultValue={values.titulaire}
                disabled={dis}
                className="input"
              />
            </Field>
            {/* La FONCTION et non le grade : c'est elle qui donne sa portée à
                la signature (« Maire », « Adjoint à la Maire », « DGA »). */}
            <Field label="Fonction" htmlFor="fonction">
              <input
                id="fonction"
                name="fonction"
                placeholder="Ex : Maire, Adjoint, Agent"
                defaultValue={values.fonction}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Adresse e-mail" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={values.email}
                disabled={dis}
                className="input"
              />
            </Field>
            {selectOption("serviceId", "Service", services, "— aucun —")}
            {/* Un certificat de machine désigne SA machine ; le laisser vide est
                le cas courant, celui d'un certificat nominatif. */}
            {selectOption("serveurId", "Serveur équipé", serveurs, "— aucun (nominatif) —")}
            <Field label="Statut" htmlFor="statut">
              <select
                id="statut"
                name="statut"
                defaultValue={values.statut || "actif"}
                disabled={dis}
                className="input"
              >
                {STATUTS_CERTIFICAT.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLES_CERTIFICAT.statut[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        {/* Ce qu'il est et jusqu'à quand il vaut. */}
        <Card title="Certificat">
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
            {selectOption("fournisseurId", "Autorité de certification", editeurs, "— aucune —")}
            <Field label="Usage" htmlFor="usage">
              <select
                id="usage"
                name="usage"
                defaultValue={values.usage}
                disabled={dis}
                className="input"
              >
                <option value="">— non renseigné —</option>
                {USAGES_CERTIFICAT.map((u) => (
                  <option key={u} value={u}>
                    {LIBELLES_CERTIFICAT.usage[u]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Support" htmlFor="support">
              <select
                id="support"
                name="support"
                defaultValue={values.support}
                disabled={dis}
                className="input"
              >
                <option value="">— non renseigné —</option>
                {SUPPORTS_CERTIFICAT.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLES_CERTIFICAT.support[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="N° de série" htmlFor="numeroSerie">
              <input
                id="numeroSerie"
                name="numeroSerie"
                defaultValue={values.numeroSerie}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Niveau" htmlFor="niveau">
              <input
                id="niveau"
                name="niveau"
                placeholder="Ex : RGS**, eIDAS qualifié"
                defaultValue={values.niveau}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Durée (années)" htmlFor="dureeAnnees">
              <select
                id="dureeAnnees"
                name="dureeAnnees"
                defaultValue={values.dureeAnnees}
                disabled={dis}
                className="input"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} an{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Début de validité" htmlFor="dateDebut">
              <input
                id="dateDebut"
                name="dateDebut"
                type="date"
                defaultValue={values.dateDebut}
                disabled={dis}
                className="input"
              />
            </Field>
            {/* L'échéance SURVEILLÉE : c'est cette date que lisent le rappel
                par e-mail et la carte du tableau de bord. La mention qui le
                disait sous le champ est retirée — un champ de date n'accueille
                pas de placeholder, et la ligne grise décalait la grille. */}
            <Field label="Fin de validité" htmlFor="dateFin">
              <input
                id="dateFin"
                name="dateFin"
                type="date"
                defaultValue={values.dateFin}
                disabled={dis}
                className="input"
              />
            </Field>
          </div>
        </Card>

        {/* Ce qu'il a coûté et comment il a été commandé. */}
        <Card title="Commande">
          <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-3">
            <Field label="Montant TTC" htmlFor="montantTtc">
              <input
                id="montantTtc"
                name="montantTtc"
                inputMode="decimal"
                defaultValue={values.montantTtc}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Imputation" htmlFor="imputation">
              <input
                id="imputation"
                name="imputation"
                placeholder="Ex : 60632"
                defaultValue={values.imputation}
                disabled={dis}
                className="input"
              />
            </Field>
            <Field label="Bon de commande signé le" htmlFor="bonCommandeLe">
              <input
                id="bonCommandeLe"
                name="bonCommandeLe"
                type="date"
                defaultValue={values.bonCommandeLe}
                disabled={dis}
                className="input"
              />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Mention du bon de commande" htmlFor="bonCommandeNote">
                <input
                  id="bonCommandeNote"
                  name="bonCommandeNote"
                  placeholder="Ex : envoyé par courrier en AR"
                  defaultValue={values.bonCommandeNote}
                  disabled={dis}
                  className="input"
                />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Observations" htmlFor="notes">
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={values.notes}
                  disabled={dis}
                  className="input"
                />
              </Field>
            </div>
          </div>
        </Card>
      </form>

      {children}

      {error ? <p className="alert-error">{error}</p> : null}

      {readOnly ? null : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {id !== undefined && !saisie.modifie ? (
              <button
                type="button"
                onClick={quitter}
                disabled={pending}
                className="btn-secondary"
                title="Revenir à la liste des certificats"
              >
                Quitter
              </button>
            ) : (
              <>
                <button type="submit" form={FORM_ID} disabled={pending} className="btn-primary">
                  {pending
                    ? "Enregistrement…"
                    : id === undefined
                      ? "Créer le certificat"
                      : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={id === undefined ? quitter : saisie.annuler}
                  disabled={pending}
                  className="btn-warn"
                  title={id === undefined ? "Quitter sans créer le certificat" : undefined}
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
                Certificat enregistré.
              </span>
            ) : null}
          </div>
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
