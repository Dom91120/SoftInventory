import { estEnRetard, joursAvantEcheance } from "@/lib/taches-core";

/** Badge d'échéance : rouge = en retard, ambre ≤ 30 j, neutre sinon. */
export function EcheanceBadge({
  echeance,
  aujourdhui,
  statut,
}: {
  echeance: Date;
  aujourdhui: Date;
  statut: string;
}) {
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
  if (statut === "terminee") return <span className="badge-muted">terminée</span>;
  if (statut === "en_pause") return <span className="badge-muted">en pause</span>;
  const jours = joursAvantEcheance(echeance, aujourdhui);
  if (estEnRetard(echeance, aujourdhui)) {
    return (
      <span className="badge-danger">
        en retard de {-jours} j — {fmt.format(echeance)}
      </span>
    );
  }
  if (jours <= 30) {
    return (
      <span className="badge-warn">
        dans {jours} j — {fmt.format(echeance)}
      </span>
    );
  }
  return <span className="badge-muted">{fmt.format(echeance)}</span>;
}
