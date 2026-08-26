"use client";

import { useEffect, useRef, useState } from "react";
import { ModaleSociete } from "@/components/modale-societe";
import { Field } from "@/components/ui";

/**
 * Les champs d'un marché, partagés par les DEUX écrans qui le saisissent : sa
 * fiche et l'onglet Contrats/Marchés d'un logiciel.
 *
 * Ce module porte la GRILLE et les LIBELLÉS ; chaque écran garde son habillage
 * et ses boutons — une carte de page ici, un encadré dans la ligne d'un marché
 * là. C'est ce qui évite que les deux divergent : une phrase d'aide corrigée
 * d'un côté l'était rarement de l'autre, et les deux écrans ont fini par
 * affirmer l'inverse l'un de l'autre sur la date de fin.
 */

export type ValeursMarche = {
  /**
   * Ce qu'est l'acte : "marche" ou "contrat". "" pour une ligne reprise de
   * l'historique, que la liste pose alors sur « Marché » — elle n'offre pas de
   * troisième choix.
   */
  nature: string;
  referenceMarche: string;
  /** Celle du fournisseur pour le même acte — son numéro de commande. */
  referenceFournisseur: string;
  libelle: string;
  fournisseurId: string;
  montantAnnuel: string;
  montantMaxi: string;
  montantTotal: string;
  dateDebut: string;
  dateFin: string;
  /** Durée ferme, en années : "1" à "4", ou "" si l'acte n'a pas été dépouillé. */
  dureeAnnees: string;
  /** Reconductions prévues : "0" à "3". "0" est une réponse, "" n'en est pas une. */
  renouvellements: string;
  /** Durée de CHAQUE reconduction, en années : "1" à "4", ou "" si non renseignée. */
  dureeRenouvellement: string;
  notes: string;
};

export const MARCHE_VIDE: ValeursMarche = {
  nature: "",
  referenceMarche: "",
  referenceFournisseur: "",
  libelle: "",
  fournisseurId: "",
  montantAnnuel: "",
  montantMaxi: "",
  montantTotal: "",
  dateDebut: "",
  dateFin: "",
  dureeAnnees: "",
  renouvellements: "",
  dureeRenouvellement: "",
  notes: "",
};

export function ChampsMarche({
  values = MARCHE_VIDE,
  editeurs,
  disabled,
}: {
  values?: ValeursMarche;
  /** Annuaire des sociétés, pour désigner le fournisseur. */
  editeurs: Array<{ id: number; nom: string }>;
  disabled: boolean;
}) {
  /**
   * Annuaire tenu localement : une société créée depuis ce formulaire doit
   * paraître dans la liste SANS recharger la page, qui perdrait la saisie.
   */
  const [annuaire, setAnnuaire] = useState(editeurs);
  const [modaleSociete, setModaleSociete] = useState(false);
  /**
   * Société à retenir une fois son option rendue. La liste est NON CONTRÔLÉE —
   * `defaultValue`, comme tout ce module, pour que « Annuler » la rende au
   * `reset()` du DOM. On pose donc la valeur sur l'élément, mais après le rendu
   * qui a ajouté l'option, d'où le passage par un effet.
   */
  const [aRetenir, setARetenir] = useState<number | null>(null);
  useEffect(() => {
    if (aRetenir === null) return;
    const liste = document.getElementById("fournisseurId");
    if (liste instanceof HTMLSelectElement) {
      liste.value = String(aRetenir);
      // Événement natif qui REMONTE : ce module ignore qui l'enveloppe, et
      // c'est le <form> parent qui suit l'écart à l'enregistré. Sans cela,
      // « Enregistrer » resterait absent alors que le marché a changé.
      liste.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setARetenir(null);
  }, [aRetenir]);

  /**
   * « an » ou « ans » à côté de la période de reconduction. Le champ reste NON
   * CONTRÔLÉ comme tous les autres — `defaultValue` —, et cet état ne sert qu'à
   * l'accord : le rendre contrôlé aurait fait perdre à « Annuler » son
   * `reset()`, qui est la mécanique de tout le module.
   */
  const champPeriode = useRef<HTMLInputElement>(null);
  const [periode, setPeriode] = useState(values.dureeRenouvellement);
  useEffect(() => {
    const form = champPeriode.current?.form;
    if (!form) return;
    // `reset()` rend au champ sa valeur par défaut : le pluriel doit la suivre,
    // sans quoi « Annuler » laisserait un « an » sur une période de 3 ans.
    const rendre = () => setPeriode(values.dureeRenouvellement);
    form.addEventListener("reset", rendre);
    return () => form.removeEventListener("reset", rendre);
  }, [values.dureeRenouvellement]);

  return (
    /**
     * TROIS RANGÉES, chacune avec sa propre découpe — et non une grille unique
     * de trois colonnes à laquelle tout devait se plier. Les champs d'un marché
     * n'ont pas tous la même largeur naturelle : une date se lit en 150 px, un
     * libellé en réclame le double, une durée tient en 100. Une grille unique
     * les alignait au prix de champs trop larges pour ce qu'ils portent.
     *
     * Les largeurs ne s'appliquent qu'à partir de `sm` : en dessous, chaque
     * champ prend la ligne entière, seule mise en page tenable sur un téléphone.
     */
    <div className="space-y-2">
      {/* Rangée 1 — l'IDENTITÉ de l'acte : ce qu'il est, son numéro chez nous,
          ce qu'il couvre, son numéro chez le fournisseur.

          Les deux références portent la même sorte de chose — un code, jamais
          une phrase — mais pas la même largeur : 100 px pour la nôtre, 180 pour
          celle du fournisseur, dont le LIBELLÉ est le plus long de la rangée et
          se replierait sur trois lignes plus court. Le libellé du marché prend
          tout ce qui reste, étant le seul champ dont la longueur soit
          imprévisible. */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nature" htmlFor="nature">
          {/* Deux choix, pas de « — » : un acte est l'un ou l'autre, il n'y a
              pas de troisième état à proposer. Les lignes reprises de
              l'historique n'ont rien en base ; la liste se pose alors sur
              « Marché », le cas de loin le plus fréquent, et l'enregistrement
              suivant l'inscrit. */}
          <select
            id="nature"
            name="nature"
            defaultValue={values.nature || "marche"}
            disabled={disabled}
            className="input w-[100px]"
          >
            <option value="marche">Marché</option>
            <option value="contrat">Contrat</option>
          </select>
        </Field>
        <div className="w-full sm:w-[100px]">
          {/* « Référence » seule : la liste d'à côté dit déjà si c'est un
              marché ou un contrat, et le libellé entier ne tenait plus dans la
              colonne une fois la nature posée devant. */}
          <Field label="Référence" htmlFor="referenceMarche">
            <input
              id="referenceMarche"
              name="referenceMarche"
              defaultValue={values.referenceMarche}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <Field label="Libellé" htmlFor="libelle">
            <input
              id="libelle"
              name="libelle"
              placeholder="Ex : marché 2024-12, pack 50 postes"
              defaultValue={values.libelle}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
        {/* La référence du FOURNISSEUR pour le même acte : les deux se lisent
            ensemble le jour où l'on appelle, l'une pour se situer, l'autre pour
            se faire reconnaître. */}
        <div className="w-full sm:w-[180px]">
          <Field label="Référence fournisseur" htmlFor="referenceFournisseur">
            <input
              id="referenceFournisseur"
              name="referenceFournisseur"
              placeholder="Ex : n° de commande chez le fournisseur"
              defaultValue={values.referenceFournisseur}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
      </div>

      {/* Rangée 2 — l'ARGENT : chez qui, et combien. Neuf parts : le
          fournisseur en prend trois, les trois montants deux chacun. Le nom
          d'une société est plus long qu'un montant, et les trois montants se
          comparent d'autant mieux qu'ils ont la même largeur. */}
      <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-9">
        <div className="sm:col-span-3">
          <Field label="Fournisseur" htmlFor="fournisseurId">
            {/* Le « + » ouvre la fiche éditeur entière, sans quitter le marché en
                cours de saisie : on découvre qu'une société manque au moment de
                la désigner. Même geste et même modale qu'au champ « Éditeur »
                d'un logiciel ou au fournisseur d'un devis. */}
            <span className="flex items-center gap-1">
              <select
                id="fournisseurId"
                name="fournisseurId"
                defaultValue={values.fournisseurId}
                disabled={disabled}
                className="input min-w-0 flex-1"
              >
                {/* « — non précisé — » et NON « l'éditeur du logiciel » : un
                    marché est signé avec la société du jour de la signature.
                    Laisser le champ vide vouloir dire « l'éditeur, quel qu'il
                    soit » faisait changer de fournisseur un acte de 2019 le jour
                    où le logiciel changeait de main — l'écran réécrivait le
                    passé. Le vide ne dit donc plus que « on ne l'a pas encore
                    dépouillé ». */}
                <option value="">— non précisé —</option>
                {annuaire.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.nom}
                  </option>
                ))}
              </select>
              {disabled ? null : (
                <button
                  type="button"
                  // Carré de 29.6 px, la hauteur de la liste. Les DEUX dimensions
                  // sont posées : privé de texte, le bouton n'a plus qu'un glyphe
                  // pour se tenir et retomberait quatre pixels plus bas.
                  className="btn-secondary !h-[1.85rem] !w-[1.85rem] shrink-0 !p-0"
                  title="Créer un fournisseur absent de l'annuaire"
                  aria-label="Créer un fournisseur absent de l'annuaire"
                  onClick={() => setModaleSociete(true)}
                >
                  <span aria-hidden className="text-sm leading-none">
                    ➕
                  </span>
                </button>
              )}
            </span>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Montant annuel" htmlFor="montantAnnuel">
            <input
              id="montantAnnuel"
              name="montantAnnuel"
              inputMode="decimal"
              defaultValue={values.montantAnnuel}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Maximum annuel" htmlFor="montantMaxi">
            <input
              id="montantMaxi"
              name="montantMaxi"
              inputMode="decimal"
              defaultValue={values.montantMaxi}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Montant total du marché" htmlFor="montantTotal">
            <input
              id="montantTotal"
              name="montantTotal"
              inputMode="decimal"
              defaultValue={values.montantTotal}
              disabled={disabled}
              className="input"
            />
          </Field>
        </div>
      </div>

      {/* Rangée 3 — le TEMPS : de quand à quand, pour combien d'années fermes,
          reconductible combien de fois.

          En FLUX LIBRE et non en grille : aucun de ces quatre champs ne gagne à
          s'étirer, et une grille leur réservait une part de rangée qu'ils
          n'occupaient pas — les dates tenaient en 130 px dans une cellule de
          161. Chacun prend ici sa largeur propre, et la rangée s'arrête où ils
          s'arrêtent. */}
      <div className="flex flex-wrap items-end gap-3">
        {/* « Début » et non « Date de début » : le champ est une date, son
            format le dit, et le mot volait un tiers de la largeur au libellé.

            Sans mention d'aide : « Prise d'effet du marché » paraphrasait le
            libellé, et « Cette date déclenche le rappel » décrivait une
            mécanique interne sous un champ qu'on vient lire, pas régler. Les
            deux tenaient sur deux lignes à cette largeur et poussaient la
            rangée d'autant. */}
        <Field label="Début" htmlFor="dateDebut">
          {/* 130 px : « 31/12/2030 » et son calendrier, pas un pixel de plus.
              Contre le `w-full` de `.input`, qui étirerait la date sur toute la
              place offerte et laisserait un vide entre le nombre et l'icône. */}
          <input
            id="dateDebut"
            name="dateDebut"
            type="date"
            defaultValue={values.dateDebut}
            disabled={disabled}
            className="input !w-[130px]"
          />
        </Field>
        <Field label="Fin" htmlFor="dateFin">
          <input
            id="dateFin"
            name="dateFin"
            type="date"
            defaultValue={values.dateFin}
            disabled={disabled}
            className="input !w-[130px]"
          />
        </Field>
        {/* La durée ferme et les reconductions se lisent AVEC la période, pas
            ailleurs : elles disent ce que « du … au … » ne dit pas — l'acte
            engage n années, et prévoit de se reconduire n fois. */}
        <div className="flex items-end gap-3">
          <Field label="Durée" htmlFor="dureeAnnees">
            {/* Largeur fixe, contre le `w-full` de `.input` : « 4 ans » et sa
                flèche tiennent dans 100 px, et la liste garde la même largeur
                quelle que soit l'option choisie — elle ne se met pas à respirer
                au fil des sélections. */}
            <select
              id="dureeAnnees"
              name="dureeAnnees"
              defaultValue={values.dureeAnnees}
              disabled={disabled}
              className="input w-[100px]"
            >
              <option value="">—</option>
              <option value="1">1 an</option>
              <option value="2">2 ans</option>
              <option value="3">3 ans</option>
              <option value="4">4 ans</option>
            </select>
          </Field>
          <Field label="Renouvelable" htmlFor="renouvellements">
            <div className="flex items-center gap-2">
              <input
                id="renouvellements"
                name="renouvellements"
                type="number"
                min={0}
                max={3}
                step={1}
                defaultValue={values.renouvellements}
                disabled={disabled}
                className="input w-16"
              />
              <span className="text-sm text-muted">fois</span>
            </div>
          </Field>
          {/* Combien de fois, puis POUR COMBIEN DE TEMPS : les deux ne disent
              rien l'un sans l'autre — « renouvelable 2 fois » ne pèse pas le
              même engagement selon que la période est d'un an ou de trois. */}
          <Field label="Par période de" htmlFor="dureeRenouvellement">
            <div className="flex items-center gap-2">
              <input
                ref={champPeriode}
                id="dureeRenouvellement"
                name="dureeRenouvellement"
                type="number"
                min={1}
                max={4}
                step={1}
                defaultValue={values.dureeRenouvellement}
                disabled={disabled}
                onInput={(e) => setPeriode(e.currentTarget.value)}
                className="input w-16"
              />
              <span className="text-sm text-muted">{periode === "1" ? "an" : "ans"}</span>
            </div>
          </Field>
        </div>
      </div>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          defaultValue={values.notes}
          disabled={disabled}
          rows={2}
          className="input"
        />
      </Field>

      {modaleSociete ? (
        <ModaleSociete
          onFermer={() => setModaleSociete(false)}
          onCreee={(societe) => {
            // Insérée dans l'ordre alphabétique, comme la liste du serveur, et
            // retenue aussitôt : c'est pour ce marché-ci qu'on l'a créée.
            setAnnuaire((liste) =>
              [...liste, societe].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
            );
            setARetenir(societe.id);
            setModaleSociete(false);
          }}
        />
      ) : null}
    </div>
  );
}
