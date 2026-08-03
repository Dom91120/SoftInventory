import type { Metadata } from "next";
import Link from "next/link";
import { EcheanceBadge } from "@/components/tache-badges";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateCalendaire, estEnRetard, joursAvantEcheance } from "@/lib/taches-core";
import { LIBELLES_TACHE } from "@/schemas/tache";
import { requireUser } from "@/server/guards";
import { listExecutionsRecentes, listTachesGlobales } from "@/server/services/taches";

export const metadata: Metadata = { title: "Tâches" };

type TacheGlobale = Awaited<ReturnType<typeof listTachesGlobales>>[number];

function LigneTache({ t, aujourdhui }: { t: TacheGlobale; aujourdhui: Date }) {
  const assigne = t.assigne
    ? `${t.assigne.prenom} ${t.assigne.nom}`.trim() || t.assigne.email
    : t.assigneLibre;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <Link
            href={`/logiciels/${t.logiciel.id}?onglet=taches`}
            className="font-medium text-strong hover:text-accent"
          >
            {t.titre}
          </Link>
          {t.typeTache ? <span className="badge-accent">{t.typeTache.label}</span> : null}
        </span>
        <span className="text-xs text-muted">
          {[
            t.logiciel.nom,
            LIBELLES_TACHE.periodicite[t.periodicite],
            assigne && `assignée à ${assigne}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <EcheanceBadge echeance={t.prochaineEcheance} aujourdhui={aujourdhui} statut={t.statut} />
    </li>
  );
}

/**
 * Vue globale des tâches d'exploitation, triée par urgence : en retard, sous
 * 30 jours, plus tard — puis l'historique récent toutes tâches confondues.
 * La complétion se fait depuis la fiche du logiciel (lien sur chaque ligne).
 */
export default async function TachesPage() {
  await requireUser();
  const [taches, executions] = await Promise.all([
    listTachesGlobales(),
    listExecutionsRecentes(15),
  ]);
  const aujourdhui = dateCalendaire(new Date());

  const actives = taches.filter((t) => t.statut === "active");
  const enRetard = actives.filter((t) => estEnRetard(t.prochaineEcheance, aujourdhui));
  const bientot = actives.filter(
    (t) =>
      !estEnRetard(t.prochaineEcheance, aujourdhui) &&
      joursAvantEcheance(t.prochaineEcheance, aujourdhui) <= 30,
  );
  const plusTard = actives.filter(
    (t) =>
      !estEnRetard(t.prochaineEcheance, aujourdhui) &&
      joursAvantEcheance(t.prochaineEcheance, aujourdhui) > 30,
  );
  const enPause = taches.filter((t) => t.statut === "en_pause");

  const fmtInstant = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

  return (
    <>
      <PageHeader
        title="Tâches"
        subtitle="Mises à jour, renouvellements, purges, certificats — sur l'ensemble du parc"
      />

      {taches.length === 0 ? (
        <EmptyState>
          Aucune tâche récurrente : elles se créent depuis la fiche d'un logiciel, onglet Tâches.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {enRetard.length > 0 ? (
            <Card title={`En retard (${enRetard.length})`}>
              <ul className="divide-y divide-line">
                {enRetard.map((t) => (
                  <LigneTache key={t.id} t={t} aujourdhui={aujourdhui} />
                ))}
              </ul>
            </Card>
          ) : null}
          <Card title={`À faire sous 30 jours (${bientot.length})`}>
            {bientot.length === 0 ? (
              <p className="text-sm text-faint">Rien à échéance dans les 30 prochains jours.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bientot.map((t) => (
                  <LigneTache key={t.id} t={t} aujourdhui={aujourdhui} />
                ))}
              </ul>
            )}
          </Card>
          {plusTard.length > 0 ? (
            <Card title={`Plus tard (${plusTard.length})`}>
              <ul className="divide-y divide-line">
                {plusTard.map((t) => (
                  <LigneTache key={t.id} t={t} aujourdhui={aujourdhui} />
                ))}
              </ul>
            </Card>
          ) : null}
          {enPause.length > 0 ? (
            <Card title={`En pause (${enPause.length})`}>
              <ul className="divide-y divide-line">
                {enPause.map((t) => (
                  <LigneTache key={t.id} t={t} aujourdhui={aujourdhui} />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      {executions.length > 0 ? (
        <div className="mt-6">
          <Card title="Réalisées récemment">
            <ul className="divide-y divide-line text-sm">
              {executions.map((ex) => (
                <li key={ex.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium text-strong">{ex.tache.titre}</span>
                    <span className="text-xs text-muted"> — {ex.tache.logiciel.nom}</span>
                    {ex.commentaire ? (
                      <span className="block text-xs text-faint">{ex.commentaire}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-faint">
                    {fmtInstant.format(ex.faitLe)}
                    {ex.faitParLabel ? ` · ${ex.faitParLabel}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
