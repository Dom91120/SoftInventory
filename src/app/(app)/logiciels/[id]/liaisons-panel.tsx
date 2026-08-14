"use client";

import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { BoutonQuitter } from "@/components/bouton-quitter";
import { useInscriptionModeFiche } from "@/components/mode-fiche";
import { Card } from "@/components/ui";
import { compareAlpha } from "@/lib/format";
import { LIBELLES } from "@/schemas/logiciel";
import {
  addInterconnexionAction,
  addServeurAction,
  removeInterconnexionAction,
  removeServeurAction,
  setServicesAction,
} from "../actions";
import type { Option } from "../fiche-form";

/**
 * Le service fourre-tout du référentiel, poussé en fin de liste : il ne désigne
 * personne en particulier et se coche quand aucun autre ne convient. Rapproché
 * par LIBELLÉ — le référentiel est saisi par l'admin, qui peut l'avoir renommé ;
 * dans ce cas la ligne reprend simplement son rang alphabétique.
 */
const SERVICE_FOURRE_TOUT = "Tous les services";

type ServeurLie = { serveurId: number; nom: string; environnement: string };
type Interco = {
  id: number;
  direction: "sortante" | "entrante";
  autre: { id: number; nom: string };
  description: string;
};

/**
 * Onglet Liaisons : services utilisateurs (cases à cocher + enregistrement du
 * delta), serveurs d'installation (serveur + environnement) et interconnexions
 * (flux orientés avec description, affichés dans les deux sens).
 */
export function LiaisonsPanel({
  logicielId,
  services,
  servicesLies,
  serveurs,
  serveursLies,
  autresLogiciels,
  interconnexions,
  readOnly,
  supprimer,
}: {
  logicielId: number;
  services: Option[];
  servicesLies: number[];
  serveurs: Option[];
  serveursLies: ServeurLie[];
  autresLogiciels: Option[];
  interconnexions: Interco[];
  readOnly: boolean;
  /**
   * La corbeille de la fiche, posée au bout de la ligne d'actions. Reçue de la
   * page plutôt que rendue ici : elle porte sur le logiciel entier, pas sur ses
   * liaisons, et c'est la page qui sait compter ses pièces jointes.
   */
  supprimer?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [coches, setCoches] = useState<Set<number>>(new Set(servicesLies));
  const [nouveauServeur, setNouveauServeur] = useState("");
  const [nouvelEnv, setNouvelEnv] = useState("production");
  const [nouvelleCible, setNouvelleCible] = useState("");
  const [nouvelleDesc, setNouvelleDesc] = useState("");

  const [saved, setSaved] = useState(false);

  /**
   * L'onglet n'a plus son propre verrou : ses trois cartes lisent LE mode
   * « je modifie cette fiche » de la barre d'onglets. Il s'y inscrit avec
   * l'écart de ses CASES — elles seules attendent un enregistrement ; un
   * serveur choisi ou un flux décrit sans avoir cliqué le bouton qui les
   * applique ne sont qu'un geste en suspens, vidé sans question. Sa part du
   * « Enregistrer » global est l'envoi de ces cases.
   */
  const mode = useInscriptionModeFiche({
    // Les cases qui s'écartent de l'enregistré, mais aussi les gestes en
    // suspens : un serveur choisi sans « Associer », un flux décrit sans
    // « Ajouter » — même utilisateur, même saisie, même sort que le reste.
    sale: () =>
      coches.size !== servicesLies.length ||
      servicesLies.some((id) => !coches.has(id)) ||
      nouveauServeur !== "" ||
      nouvelleCible !== "" ||
      nouvelleDesc !== "",
    rendre: () => {
      setCoches(new Set(servicesLies));
      vider();
    },
    enregistrer: async () => {
      setError(null);
      // Les cases, si elles ont bougé.
      if (coches.size !== servicesLies.length || servicesLies.some((id) => !coches.has(id))) {
        const res = await setServicesAction(logicielId, [...coches]);
        if (!res.ok) {
          setError(res.error ?? "Erreur.");
          return false;
        }
        setSaved(true);
      }
      // Le serveur choisi mais pas encore associé : « Enregistrer » l'applique,
      // comme son bouton.
      if (nouveauServeur) {
        const res = await addServeurAction(logicielId, Number(nouveauServeur), nouvelEnv);
        if (!res.ok) {
          setError(res.error ?? "Erreur.");
          return false;
        }
        setNouveauServeur("");
      }
      // Le flux décrit : sa cible est obligatoire — une description seule ne
      // désigne aucun logiciel, et on ne la jette pas sans le dire.
      if (nouvelleCible) {
        const res = await addInterconnexionAction(logicielId, Number(nouvelleCible), nouvelleDesc);
        if (!res.ok) {
          setError(res.error ?? "Erreur.");
          return false;
        }
        setNouvelleCible("");
        setNouvelleDesc("");
      } else if (nouvelleDesc) {
        setError("Une interconnexion est décrite mais son logiciel cible n'est pas choisi.");
        return false;
      }
      router.refresh();
      return true;
    },
  });
  const ouvert = !!mode?.actif;
  const casesFigees = readOnly || pending || !ouvert;
  /**
   * Les deux autres cartes n'ont rien à enregistrer — associer un serveur,
   * déclarer un flux, les retirer : tout s'applique au clic. Le mode n'y
   * donne que le DROIT DE TOUCHER ; `pending` ne les fige pas, chaque bouton
   * porte déjà son propre `disabled`.
   */
  const serveursFiges = readOnly || !ouvert;
  const intercosFigees = readOnly || !ouvert;

  /** Vide les saisies en cours : un serveur choisi sans le bouton qui
   *  l'associe, une description de flux sans sa cible, n'attendent plus rien
   *  une fois les cartes closes. */
  function vider() {
    setNouveauServeur("");
    setNouvelleCible("");
    setNouvelleDesc("");
  }

  /**
   * Ordre alphabétique, et non celui du référentiel : on cherche ici un service
   * qu'on a en tête, ce qui suppose de savoir où le trouver. `compareAlpha`
   * plutôt que la base — la collation du serveur trierait « Élections » après
   * « Urbanisme ».
   */
  const servicesTries = [...services].sort((a, b) => {
    const aFourreTout = a.label === SERVICE_FOURRE_TOUT;
    const bFourreTout = b.label === SERVICE_FOURRE_TOUT;
    if (aFourreTout !== bFourreTout) return aFourreTout ? 1 : -1;
    return compareAlpha(a.label, b.label);
  });

  /** La confirmation s'efface d'elle-même, comme sur les fiches. */
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else {
        onOk?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="alert-error">{error}</p> : null}

      <Card title="Services utilisateurs">
        {services.length === 0 ? (
          <p className="text-sm text-faint">
            Aucun service dans le référentiel — ajoutez-les depuis Administration › Référentiels.
          </p>
        ) : (
          // Jusqu'à QUATRE colonnes sur un large écran : le référentiel compte
          // une trentaine de services, et trois colonnes les étalaient sur dix
          // rangées qu'il fallait parcourir pour en cocher deux.
          //
          // Aucun écart, ni vertical ni horizontal : les cases se lisent comme
          // une liste, et l'air entre elles allongeait la carte sans rien
          // séparer — la ligne de chaque case, et la case elle-même en tête de
          // colonne, suffisent à les distinguer. La place ainsi rendue revient
          // aux LIBELLÉS, chaque colonne s'élargissant de ce que la gouttière
          // prenait : c'est eux qui manquaient de largeur, pas les colonnes qui
          // manquaient d'écart.
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {servicesTries.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-body">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-(--color-accent)"
                  checked={coches.has(s.id)}
                  disabled={casesFigees}
                  onChange={(e) => {
                    const next = new Set(coches);
                    if (e.target.checked) next.add(s.id);
                    else next.delete(s.id);
                    setCoches(next);
                  }}
                />
                {s.label}
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card title="Serveurs d'installation">
        {serveursLies.length === 0 ? (
          <p className="mb-3 text-sm text-faint">Aucun serveur associé.</p>
        ) : (
          // Sans filets entre les lignes : deux installations d'un même
          // logiciel se lisent comme une liste, pas comme deux données
          // distinctes qu'il faudrait séparer — même règle que les cartes de
          // l'écran Serveurs.
          <ul className="mb-3 text-sm">
            {serveursLies.map((s) => (
              <li
                key={`${s.serveurId}-${s.environnement}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {/* Le nom mène à la FICHE du serveur — son système, sa
                      localisation, le reste de ce qu'il porte. Comme les
                      interconnexions mènent à la fiche du logiciel d'en face :
                      un nom d'objet de l'inventaire est un lien vers cet objet. */}
                  <Link
                    href={`/serveurs/${s.serveurId}`}
                    className="font-medium text-strong hover:text-accent"
                  >
                    {s.nom}
                  </Link>
                  <span
                    className={`ml-2 ${s.environnement === "production" ? "badge-ok" : "badge-muted"}`}
                  >
                    {LIBELLES.environnement[s.environnement as keyof typeof LIBELLES.environnement]}
                  </span>
                </span>
                {serveursFiges ? null : (
                  <button
                    type="button"
                    className="btn-ghost !p-2 hover:!text-danger"
                    title="Retirer"
                    disabled={pending}
                    onClick={() =>
                      run(() => removeServeurAction(logicielId, s.serveurId, s.environnement))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {serveursFiges ? null : serveurs.length === 0 ? (
          <p className="text-sm text-faint">
            Aucun serveur dans l'inventaire — créez-en un depuis l'écran{" "}
            <Link href="/serveurs" className="text-accent hover:underline">
              Serveurs
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input !w-auto"
              value={nouveauServeur}
              onChange={(e) => setNouveauServeur(e.target.value)}
              disabled={pending}
              aria-label="Serveur"
            >
              <option value="">Choisir un serveur…</option>
              {serveurs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              className="input !w-auto"
              value={nouvelEnv}
              onChange={(e) => setNouvelEnv(e.target.value)}
              disabled={pending}
              aria-label="Environnement"
            >
              {Object.entries(LIBELLES.environnement).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || !nouveauServeur}
              onClick={() =>
                run(
                  () => addServeurAction(logicielId, Number(nouveauServeur), nouvelEnv),
                  () => setNouveauServeur(""),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Associer
            </button>
          </div>
        )}
      </Card>

      <Card title="Interconnexions">
        {interconnexions.length === 0 ? (
          <p className="mb-3 text-sm text-faint">
            Aucune interconnexion déclarée (échanges de données avec d'autres logiciels).
          </p>
        ) : (
          <ul className="mb-3 divide-y divide-line text-sm">
            {interconnexions.map((ix) => (
              <li key={ix.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  {ix.direction === "sortante" ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <ArrowLeft className="h-4 w-4 shrink-0 text-info" />
                  )}
                  <Link
                    href={`/logiciels/${ix.autre.id}`}
                    className="font-medium text-strong hover:text-accent"
                  >
                    {ix.autre.nom}
                  </Link>
                  {ix.description ? (
                    <span className="truncate text-xs text-muted">— {ix.description}</span>
                  ) : null}
                </span>
                {intercosFigees ? null : (
                  <button
                    type="button"
                    className="btn-ghost !p-2 hover:!text-danger"
                    title="Supprimer l'interconnexion"
                    disabled={pending}
                    onClick={() => run(() => removeInterconnexionAction(ix.id, logicielId))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {intercosFigees ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input !w-auto"
              value={nouvelleCible}
              onChange={(e) => setNouvelleCible(e.target.value)}
              disabled={pending}
              aria-label="Logiciel cible"
            >
              <option value="">Vers le logiciel…</option>
              {autresLogiciels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <input
              className="input !w-72"
              placeholder="Description du flux (ex : export paie mensuel)"
              value={nouvelleDesc}
              onChange={(e) => setNouvelleDesc(e.target.value)}
              disabled={pending}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || !nouvelleCible}
              onClick={() =>
                run(
                  () => addInterconnexionAction(logicielId, Number(nouvelleCible), nouvelleDesc),
                  () => {
                    setNouvelleCible("");
                    setNouvelleDesc("");
                  },
                )
              }
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        )}
      </Card>

      {/* Une seule ligne d'actions, tout en bas, comme sur la Synthèse : les
          gestes qui portent sur l'onglet à gauche, la corbeille au bout.

          Elle suit l'état du MODE, et ses deux boutons portent la FICHE
          ENTIÈRE : « Enregistrer » enregistre chaque onglet qui porte une
          saisie — ici, les cases —, « Annuler » rend tout et referme, le même
          geste que le crayon. Les serveurs et les interconnexions n'attendent
          rien d'eux : ils s'appliquent AU CLIC, chacun dans sa carte. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!readOnly && ouvert ? (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={pending || mode?.occupe}
                onClick={() => void mode?.enregistrerTout()}
              >
                {pending || mode?.occupe ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                className="btn-warn"
                disabled={pending || mode?.occupe}
                onClick={() => void mode?.annulerTout()}
              >
                Annuler
              </button>
            </>
          ) : (
            <BoutonQuitter vers="/logiciels" titre="Revenir à la liste des logiciels" />
          )}
          {saved ? (
            <span
              className="flex items-center gap-1.5 text-sm"
              style={{ color: "var(--color-ok-text)" }}
            >
              <Check className="h-4 w-4" />
              Services enregistrés.
            </span>
          ) : null}
        </div>
        {supprimer}
      </div>
    </div>
  );
}
