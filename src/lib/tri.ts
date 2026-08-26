/**
 * Le sens d'un tri de colonne, commun à toutes les listes dont les en-têtes
 * sont cliquables (marchés, certificats).
 *
 * Ici plutôt que dans l'un des services qui l'emploient : les deux listes
 * trient de la même façon, et la troisième qui s'y mettra n'aura pas à choisir
 * de qui elle l'importe.
 */
export type SensTri = "asc" | "desc";
