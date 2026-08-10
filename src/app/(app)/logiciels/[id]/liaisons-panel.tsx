"use client";

import { ArrowLeft, ArrowRight, Check, Plus, SquarePen, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { BoutonQuitter } from "@/components/bouton-quitter";
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
   * Les cases s'ouvrent sous clé, comme les cartes de saisie des fiches : on
   * vient bien plus souvent lire quels services utilisent un logiciel qu'en
   * changer la liste, et une case se décoche d'un clic malheureux sans que rien
   * ne le signale. Le crayon de l'en-tête lève le verrou.
   */
  const [verrouille, setVerrouille] = useState(true);
  const casesFigees = readOnly || pending || verrouille;

  /**
   * Les deux autres cartes n'ont rien à enregistrer — associer un serveur,
   * déclarer un flux, les retirer : tout s'applique au clic. Elles reçoivent
   * donc l'interrupteur des mises en concurrence, et non le verrou des cases :
   * ni coche ni croix, le crayon donne le droit de toucher.
   *
   * UN interrupteur PAR CARTE : elles ne parlent pas de la même chose, et
   * ouvrir les serveurs n'a pas à découvrir les interconnexions.
   */
  const [modeServeurs, setModeServeurs] = useState(false);
  const [modeIntercos, setModeIntercos] = useState(false);
  const serveursFiges = readOnly || !modeServeurs;
  const intercosFigees = readOnly || !modeIntercos;

  /** Le crayon d'une carte qui s'applique au clic : allumé, éteint, rien d'autre. */
  const crayon = (actif: boolean, basculer: () => void, quoi: string) =>
    readOnly ? undefined : (
      <button
        type="button"
        onClick={basculer}
        disabled={pending}
        aria-pressed={actif}
        title={actif ? "Fermer la modification" : `Modifier ${quoi}`}
        aria-label={actif ? "Fermer la modification" : `Modifier ${quoi}`}
        className={`btn-ghost !p-2 ${actif ? "!text-accent" : "hover:!text-accent"}`}
      >
        <SquarePen className="h-4 w-4" />
      </button>
    );

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

  /**
   * « Les cases diffèrent-elles de ce qui est enregistré ? » — l'équivalent, pour
   * des cases contrôlées, de l'empreinte que les fiches relèvent sur leur
   * formulaire. C'est lui qui décide d'offrir ou non « Enregistrer ».
   */
  const dirtyServices =
    coches.size !== servicesLies.length || servicesLies.some((id) => !coches.has(id));

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

  /** Enregistre les cases puis referme : la modification est faite. */
  function enregistrerServices() {
    run(
      () => setServicesAction(logicielId, [...coches]),
      () => {
        setSaved(true);
        setVerrouille(true);
      },
    );
  }

  /** Referme en rendant aux cases leurs valeurs enregistrées — le geste
   *  d'« Annuler », qui ne perd que des clics. */
  function fermerServices() {
    setCoches(new Set(servicesLies));
    setVerrouille(true);
  }

  /**
   * Les commandes du verrou. Pas de `preventDefault` ici, contrairement aux
   * fiches : ces boutons ne vivent dans aucun <form>, aucune action par défaut
   * n'est à annuler. Les `key` restent — elles interdisent à React de recycler
   * un nœud pour son remplaçant et de lui laisser des attributs qui ne sont
   * plus les siens.
   */
  const commandesServices = readOnly ? undefined : verrouille ? (
    <button
      key="verrou-ouvrir"
      type="button"
      onClick={() => setVerrouille(false)}
      disabled={pending}
      title="Modifier les services"
      aria-label="Modifier les services"
      className="btn-ghost !p-2 hover:!text-accent"
    >
      <SquarePen className="h-4 w-4" />
    </button>
  ) : (
    <>
      {dirtyServices ? (
        <button
          key="verrou-valider"
          type="button"
          onClick={enregistrerServices}
          disabled={pending}
          title="Enregistrer les services"
          aria-label="Enregistrer les services"
          className="btn-ghost !p-2 hover:!text-ok"
        >
          <Check className="h-4 w-4" />
        </button>
      ) : null}
      <button
        key="verrou-annuler"
        type="button"
        onClick={fermerServices}
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
      {error ? <p className="alert-error">{error}</p> : null}

      <Card title="Services utilisateurs" actions={commandesServices}>
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

      <Card
        title="Serveurs d'installation"
        actions={crayon(
          modeServeurs,
          () => {
            // Éteindre vide le choix en cours : un serveur sélectionné sans le
            // bouton qui l'associe n'attend plus rien.
            if (modeServeurs) setNouveauServeur("");
            setModeServeurs(!modeServeurs);
          },
          "les serveurs",
        )}
      >
        {serveursLies.length === 0 ? (
          <p className="mb-3 text-sm text-faint">Aucun serveur associé.</p>
        ) : (
          <ul className="mb-3 divide-y divide-line text-sm">
            {serveursLies.map((s) => (
              <li
                key={`${s.serveurId}-${s.environnement}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  <span className="font-medium text-strong">{s.nom}</span>
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
            Aucun serveur dans le référentiel — ajoutez-les depuis Administration › Référentiels.
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

      <Card
        title="Interconnexions"
        actions={crayon(
          modeIntercos,
          () => {
            if (modeIntercos) {
              setNouvelleCible("");
              setNouvelleDesc("");
            }
            setModeIntercos(!modeIntercos);
          },
          "les interconnexions",
        )}
      >
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
              placeholder="Description du flux (ex. export paie mensuel)"
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

          Tant que les cases ne diffèrent pas de l'enregistré, il n'y a rien à
          enregistrer et le seul geste qui reste est de partir. Dès qu'une case
          bouge, « Enregistrer » prend la place de « Quitter » et « Annuler » le
          rejoint, qui rend aux cases leurs valeurs enregistrées — sans
          confirmation, il n'y a que des clics à perdre.

          Les serveurs et les interconnexions n'y figurent pas : ils s'appliquent
          AU CLIC, chacun dans sa carte. Seules les cases attendent un
          enregistrement, parce qu'on en coche plusieurs d'affilée. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!readOnly && dirtyServices ? (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={enregistrerServices}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                className="btn-warn"
                disabled={pending}
                onClick={() => setCoches(new Set(servicesLies))}
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
