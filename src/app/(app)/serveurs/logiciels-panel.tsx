"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ModaleLogiciel } from "@/components/modale-logiciel";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { Card } from "@/components/ui";
import { compareAlpha } from "@/lib/format";
import { addServeurAction, removeServeurAction } from "../logiciels/actions";

export type Installation = { logicielId: number; nom: string };
type Option = { id: number; label: string };
type OptionCle = { cle: string; label: string };

/** Les référentiels dont la modale de création a besoin, groupés : ils ne
 *  servent QU'À elle, et six props de plus noieraient celles du panneau. */
export type ReferentielsLogiciel = {
  editeurs: Option[];
  technologies: Option[];
  criticites: Option[];
  statuts: OptionCle[];
  hebergements: OptionCle[];
};

/**
 * Les logiciels qui tournent sur cette machine — et le moyen de les y déclarer.
 *
 * La même installation se pose des DEUX côtés : depuis l'onglet Liaisons du
 * logiciel, où l'on part de l'application, et depuis ici, où l'on part de la
 * machine — « je viens de monter ce serveur, voilà ce qu'il porte ». Un seul
 * couple de server actions pour les deux (`addServeurAction` / `removeServeurAction`,
 * fiche logiciel) : c'est la même ligne de la table de liaison, et deux copies
 * auraient fini par diverger sur ce qu'elles revalident.
 *
 * Le verrou est celui de la fiche : rien ne s'ajoute ni ne se retire tant que le
 * crayon n'est pas allumé. Les gestes, eux, s'appliquent AU CLIC — « Associer »
 * et la corbeille n'attendent pas le « Enregistrer » de la fiche. Sa part du
 * mode se limite au choix en suspens : un logiciel désigné sans avoir cliqué
 * « Associer » est une saisie comme une autre, que « Enregistrer » applique et
 * qu'« Annuler » jette.
 *
 * EN CRÉATION (`serveurId` absent), la machine n'existe pas encore : il n'y a
 * aucune ligne de liaison à écrire, et rien ne part au serveur. Les
 * installations s'empilent dans l'état du parent, qui les posera toutes une
 * fois le serveur créé — on monte un serveur en disant du même geste ce qu'on
 * y met. Pas de verrou non plus : une fiche qu'on est en train de saisir n'a
 * rien à protéger.
 */
export function LogicielsPanel({
  serveurId,
  installations,
  onChangeEnAttente,
  logiciels,
  referentiels,
  readOnly,
}: {
  /** Absent = création : les installations attendent que la machine existe. */
  serveurId?: number;
  installations: Installation[];
  /** En création, la liste vit chez le parent : c'est lui qui l'appliquera. */
  onChangeEnAttente?: (installations: Installation[]) => void;
  /** Tout l'inventaire : c'est parmi lui qu'on désigne ce qui tourne ici. */
  logiciels: Option[];
  /** De quoi créer un logiciel absent de l'inventaire, sans quitter la fiche. */
  referentiels: ReferentielsLogiciel;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nouveauLogiciel, setNouveauLogiciel] = useState("");
  /**
   * L'inventaire tenu localement : un logiciel créé depuis cette carte doit
   * paraître dans la liste SANS recharger la page, qui perdrait la saisie de la
   * fiche. Même façon de faire que le parc, côté onglet Liaisons.
   */
  const [inventaire, setInventaire] = useState(logiciels);
  const [modaleLogiciel, setModaleLogiciel] = useState(false);

  /** Associe le logiciel choisi ; vrai si c'est fait (ou s'il n'y a rien à faire). */
  async function associer(): Promise<boolean> {
    if (!nouveauLogiciel) return true;
    setError(null);
    const logicielId = Number(nouveauLogiciel);
    // En création, rien ne part au serveur : la ligne de liaison exige les DEUX
    // identifiants, et la machine n'en a pas encore. L'installation rejoint la
    // liste en attente, que le formulaire posera après la création.
    if (serveurId === undefined) {
      const deja = installations.some((i) => i.logicielId === logicielId);
      if (!deja) {
        const nom = inventaire.find((l) => l.id === logicielId)?.label ?? "";
        onChangeEnAttente?.([...installations, { logicielId, nom }]);
      }
      setNouveauLogiciel("");
      return true;
    }
    const res = await addServeurAction(logicielId, serveurId);
    if (!res.ok) {
      setError(res.error ?? "Erreur.");
      return false;
    }
    setNouveauLogiciel("");
    router.refresh();
    return true;
  }

  const mode = useInscriptionModeFiche({
    sale: () => nouveauLogiciel !== "",
    rendre: () => setNouveauLogiciel(""),
    enregistrer: associer,
  });
  /** Le mode ne gouverne que la FICHE : en création, tout est ouvert d'emblée. */
  const ouvert = mode ? mode.actif : serveurId === undefined;
  const fige = readOnly || !ouvert;

  function retirer(i: Installation) {
    setError(null);
    if (serveurId === undefined) {
      onChangeEnAttente?.(installations.filter((x) => x.logicielId !== i.logicielId));
      return;
    }
    startTransition(async () => {
      const res = await removeServeurAction(i.logicielId, serveurId);
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card title="Logiciels installés">
      {error ? <p className="alert-error mb-3">{error}</p> : null}
      {installations.length === 0 ? (
        // L'invite ne paraît qu'avec la ligne qu'elle désigne : fiche fermée,
        // il n'y a rien « ci-dessous » où choisir.
        <p className="mb-3 text-sm text-faint">
          Aucun logiciel installé sur ce serveur.
          {fige ? "" : " Déclarez-le en le choisissant ci-dessous."}
        </p>
      ) : (
        // Sans filets entre les lignes : deux logiciels d'une même machine se
        // lisent comme une liste, pas comme deux données qu'il faudrait séparer
        // — même règle que les cartes de l'écran Serveurs.
        <ul className="mb-3 text-sm">
          {installations.map((i) => (
            <li key={i.logicielId} className="flex items-center justify-between gap-3 pt-2">
              <Link
                href={`/logiciels/${i.logicielId}`}
                className="font-medium text-strong hover:text-accent"
              >
                {i.nom}
              </Link>
              {fige ? null : (
                <button
                  type="button"
                  className="btn-ghost !p-2 hover:!text-danger"
                  title="Retirer"
                  disabled={pending}
                  onClick={() => retirer(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {fige ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {inventaire.length === 0 ? (
            <p className="basis-full text-sm text-faint">
              Aucun logiciel dans l'inventaire — créez le premier avec le « + », ou depuis l'écran{" "}
              <Link href="/logiciels" className="text-accent hover:underline">
                Logiciels
              </Link>
              .
            </p>
          ) : null}
          {/* Plafonnée : `!w-auto` donne à la liste la largeur de son option la
              plus longue, et un nom de logiciel peut faire quarante caractères —
              la ligne passait alors à deux rangs pour un seul choix. */}
          <select
            className="input !w-auto max-w-56 sm:max-w-72"
            value={nouveauLogiciel}
            onChange={(e) => setNouveauLogiciel(e.target.value)}
            disabled={pending}
            aria-label="Logiciel"
          >
            <option value="">Choisir un logiciel…</option>
            {inventaire.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          {/* Le « + » ouvre l'identité d'un logiciel en modale, sans quitter la
              fiche : on découvre que l'application manque à l'inventaire au
              moment de la déclarer installée ici. Même geste qu'au serveur de
              l'onglet Liaisons et qu'à l'éditeur de la Synthèse. Carré de
              1,85 rem, la hauteur des listes qu'il accompagne. */}
          <button
            type="button"
            className="btn-secondary !h-[1.85rem] !w-[1.85rem] shrink-0 !p-0"
            title="Créer un logiciel absent de l'inventaire"
            aria-label="Créer un logiciel absent de l'inventaire"
            disabled={pending}
            onClick={() => setModaleLogiciel(true)}
          >
            <span aria-hidden className="text-sm leading-none">
              ➕
            </span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending || !nouveauLogiciel}
            onClick={() =>
              startTransition(async () => {
                await associer();
              })
            }
          >
            <Plus className="h-4 w-4" />
            Associer
          </button>
        </div>
      )}

      {modaleLogiciel ? (
        <ModaleLogiciel
          {...referentiels}
          onFermer={() => setModaleLogiciel(false)}
          onCree={(logiciel) => {
            // Inséré dans l'ordre alphabétique, celui de la liste, et retenu
            // aussitôt : c'est pour le déclarer ici qu'on vient de le créer.
            // « Associer » reste le geste qui pose l'installation.
            setInventaire((liste) =>
              [...liste, { id: logiciel.id, label: logiciel.nom }].sort((a, b) =>
                compareAlpha(a.label, b.label),
              ),
            );
            setNouveauLogiciel(String(logiciel.id));
            setModaleLogiciel(false);
          }}
        />
      ) : null}
    </Card>
  );
}
