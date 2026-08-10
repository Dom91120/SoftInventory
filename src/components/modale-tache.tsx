"use client";

import { LIBELLES_TACHE } from "@/schemas/tache";

/**
 * Ce que la modale MONTRE, et rien de plus : ni identifiants de référentiel ni
 * champs de saisie. Les deux écrans qui l'ouvrent — l'onglet Tâches d'un
 * logiciel et le tableau de bord — n'ont pas la même forme de tâche en main,
 * mais tous deux savent produire ceci.
 *
 * Les dates arrivent DÉJÀ formatées pour l'historique (le serveur les rend) et
 * en AAAA-MM-JJ pour l'échéance, telle que la saisie HTML la produit.
 */
export type TacheDetail = {
  titre: string;
  description: string;
  typeTacheLabel: string | null;
  periodicite: string;
  moisPersonnalises: string;
  prochaineEcheance: string;
  statut: string;
  assigneLabel: string;
  rappelJoursAvant: string;
  executions: Array<{
    id: number;
    faitLe: string;
    echeancePrevue: string;
    par: string;
    commentaire: string;
  }>;
};

/** "AAAA-MM-JJ" → "JJ/MM/AAAA", ancrée en UTC comme la colonne `@db.Date`. */
const FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });

/**
 * La fiche d'une tâche, en LECTURE : tout ce qu'elle porte, y compris ce que la
 * ligne d'une liste résume ou tait — l'intervalle d'une périodicité
 * personnalisée, le statut, le délai de rappel —, plus son historique
 * d'exécutions en entier.
 *
 * Une modale et non un dépliant : la liste garde sa hauteur, et lire une tâche
 * n'a pas à repousser les suivantes. Elle n'écrit rien et s'ouvre donc au
 * lecteur comme à l'admin, crayon éteint ou non — voir n'est pas modifier.
 */
export function ModaleTache({ tache, onFermer }: { tache: TacheDetail; onFermer: () => void }) {
  const lignes: Array<[string, string]> = [
    ["Type", tache.typeTacheLabel ?? "—"],
    [
      "Périodicité",
      LIBELLES_TACHE.periodicite[tache.periodicite as keyof typeof LIBELLES_TACHE.periodicite],
    ],
    ...(tache.moisPersonnalises
      ? ([["Intervalle", `${tache.moisPersonnalises} mois`]] as Array<[string, string]>)
      : []),
    [
      "Prochaine échéance",
      tache.prochaineEcheance
        ? FMT.format(new Date(`${tache.prochaineEcheance}T00:00:00.000Z`))
        : "—",
    ],
    ["Statut", LIBELLES_TACHE.statut[tache.statut as keyof typeof LIBELLES_TACHE.statut]],
    ["Assignée à", tache.assigneLabel || "—"],
    [
      "Rappel",
      // Vide = le seuil global d'Administration › Messagerie s'applique. On le
      // dit ici, là où la question se pose, plutôt que sur chaque ligne.
      tache.rappelJoursAvant ? `${tache.rappelJoursAvant} jours avant` : "délai global",
    ],
  ];

  return (
    // Le fond ferme la modale au clic ; au clavier, Échap et le bouton Fermer
    // font le même travail. Même enveloppe que la modale de société.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onFermer();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-tache"
        className="my-8 w-full max-w-2xl rounded-2xl border border-line bg-surface px-5 py-4 shadow-lg"
      >
        <h3 id="titre-tache" className="mb-3 font-semibold text-lg text-strong">
          {tache.titre}
        </h3>

        <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          {lignes.map(([label, valeur]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="text-sm text-strong">{valeur}</dd>
            </div>
          ))}
          {tache.description ? (
            <div className="sm:col-span-2">
              <dt className="label">Description</dt>
              {/* `whitespace-pre-line` : la description est saisie en zone de
                  texte, ses retours à la ligne font partie de ce qu'on a écrit. */}
              <dd className="whitespace-pre-line text-sm text-strong">{tache.description}</dd>
            </div>
          ) : null}
        </dl>

        <h4 className="label mt-4 mb-2">Historique ({tache.executions.length})</h4>
        {tache.executions.length === 0 ? (
          <p className="text-sm text-faint">Aucune exécution enregistrée.</p>
        ) : (
          <ul className="space-y-1 border-line border-l-2 pl-4 text-muted text-sm">
            {tache.executions.map((ex) => (
              <li key={ex.id}>
                <span className="font-medium text-body">{ex.faitLe}</span> — échéance prévue{" "}
                {ex.echeancePrevue}
                {ex.par ? ` · par ${ex.par}` : ""}
                {ex.commentaire ? ` · ${ex.commentaire}` : ""}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
