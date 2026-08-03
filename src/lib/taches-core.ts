// Cœur PUR du moteur de tâches récurrentes (testé par taches-core.test.ts) :
// calcul des échéances, retard, seuil de rappel. Aucune I/O — les services et
// le cron s'appuient dessus.
//
// Toutes les dates métier sont des DATES CALENDAIRES (colonne @db.Date, minuit
// UTC) : on calcule en UTC pour qu'un décalage de fuseau ne déplace jamais un
// 31 janvier vers un 30.

export type PeriodiciteTache =
  | "mensuelle"
  | "trimestrielle"
  | "semestrielle"
  | "annuelle"
  | "personnalisee"
  | "ponctuelle";

/** Intervalle en mois d'une périodicité ; null pour une tâche ponctuelle. */
export function moisDePeriodicite(
  periodicite: PeriodiciteTache,
  moisPersonnalises: number | null,
): number | null {
  switch (periodicite) {
    case "mensuelle":
      return 1;
    case "trimestrielle":
      return 3;
    case "semestrielle":
      return 6;
    case "annuelle":
      return 12;
    case "personnalisee":
      // Garde-fou : un intervalle absurde (0, négatif, > 10 ans) retombe sur 12.
      return moisPersonnalises && moisPersonnalises >= 1 && moisPersonnalises <= 120
        ? moisPersonnalises
        : 12;
    case "ponctuelle":
      return null;
  }
}

/**
 * `date` + `mois` mois, avec CLAMP de fin de mois : 31 janvier + 1 mois →
 * 28/29 février (jamais un débordement silencieux vers le 2/3 mars, le
 * comportement natif de Date).
 */
export function ajouterMois(date: Date, mois: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  // Dernier jour du mois cible : jour 0 du mois suivant.
  const dernierJour = new Date(Date.UTC(y, m + mois + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + mois, Math.min(d, dernierJour)));
}

/**
 * Prochaine échéance après complétion, ANCRÉE sur l'échéance prévue (jamais la
 * date de complétion) : une tâche mensuelle du 1er faite le 12 reste attendue
 * pour le 1er suivant — pas de dérive du calendrier. Si plusieurs occurrences
 * ont été manquées, on avance jusqu'à la première échéance STRICTEMENT future
 * (rattraper trois purges d'un coup n'a pas de sens).
 *
 * Renvoie null pour une tâche ponctuelle (elle se clôt).
 */
export function prochaineEcheanceApres(
  echeance: Date,
  periodicite: PeriodiciteTache,
  moisPersonnalises: number | null,
  aujourdhui: Date,
): Date | null {
  const mois = moisDePeriodicite(periodicite, moisPersonnalises);
  if (mois === null) return null;
  let next = ajouterMois(echeance, mois);
  while (next.getTime() <= aujourdhui.getTime()) {
    next = ajouterMois(next, mois);
  }
  return next;
}

/** La tâche est-elle en retard ? (échéance strictement passée) */
export function estEnRetard(prochaineEcheance: Date, aujourdhui: Date): boolean {
  return prochaineEcheance.getTime() < aujourdhui.getTime();
}

/** Jours calendaires restant avant l'échéance (négatif si dépassée). */
export function joursAvantEcheance(prochaineEcheance: Date, aujourdhui: Date): number {
  return Math.round((prochaineEcheance.getTime() - aujourdhui.getTime()) / 86_400_000);
}

/**
 * Seuil de rappel effectif (jours avant échéance) : valeur propre à la tâche
 * si renseignée et sensée, sinon le défaut global (app_config).
 */
export function seuilRappel(rappelJoursAvant: number | null, defautGlobal: number): number {
  if (rappelJoursAvant !== null && rappelJoursAvant >= 0 && rappelJoursAvant <= 365) {
    return rappelJoursAvant;
  }
  return defautGlobal;
}

/**
 * Faut-il envoyer le rappel de cette occurrence ?
 *  - l'échéance entre dans la fenêtre (jours restants ≤ seuil) — retard compris ;
 *  - ET aucun rappel déjà envoyé POUR CETTE échéance (anti-doublon).
 */
export function rappelDu(
  prochaineEcheance: Date,
  rappelEnvoyePour: Date | null,
  rappelJoursAvant: number | null,
  defautGlobal: number,
  aujourdhui: Date,
): boolean {
  if (rappelEnvoyePour?.getTime() === prochaineEcheance.getTime()) return false;
  return (
    joursAvantEcheance(prochaineEcheance, aujourdhui) <= seuilRappel(rappelJoursAvant, defautGlobal)
  );
}

/** Date calendaire (minuit UTC) du jour courant — à passer aux fonctions ci-dessus. */
export function dateCalendaire(instant: Date): Date {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
}
