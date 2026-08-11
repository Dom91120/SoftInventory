import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardList,
  Euro,
  Package,
  Server,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/server/guards";
import { chargerDashboard, type Repartition } from "@/server/services/dashboard";
import { MesTaches } from "./mes-taches";

export const metadata: Metadata = { title: "Tableau de bord" };

const fmtDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const fmtEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Barre de répartition empilée + légende (barres serveur, sans bibliothèque). */
function BarreRepartition({ data }: { data: Repartition }) {
  const total = data.reduce((s, d) => s + d.nb, 0);
  if (total === 0) return <p className="text-sm text-faint">Aucune donnée.</p>;
  return (
    <>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-inset">
        {data.map((d) => (
          <span
            key={d.label}
            title={`${d.label} : ${d.nb}`}
            style={{ width: `${(d.nb / total) * 100}%`, background: d.couleur }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-body">
              <span className="h-2 w-2 rounded-full" style={{ background: d.couleur }} />
              {d.label}
            </span>
            <span className="font-mono text-strong tabular-nums">{d.nb}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function TableauDeBordPage() {
  const session = await requireUser();
  const d = await chargerDashboard(session.user.id);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble du parc logiciel de la collectivité"
      />

      {/* Bandeaux d'alerte actionnables */}
      {d.tachesEnRetard.length > 0 ? (
        <Link
          href="/taches"
          className="alert-danger mb-3 flex items-center gap-3 transition hover:brightness-110"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
          <span>
            <strong className="text-danger-text">
              {d.tachesEnRetard.length} tâche{d.tachesEnRetard.length > 1 ? "s" : ""} en retard.
            </strong>{" "}
            <span className="text-muted">
              La plus ancienne : « {d.tachesEnRetard[0].titre} » ({d.tachesEnRetard[0].logiciel}).
            </span>{" "}
            <span className="font-medium underline">Traiter</span>
          </span>
        </Link>
      ) : null}
      {d.contratsDepasses.length > 0 ? (
        <Link
          href="/logiciels"
          className="alert-warn mb-3 flex items-center gap-3 transition hover:brightness-110"
        >
          <Users className="h-5 w-5 shrink-0 text-warn" />
          <span>
            <strong className="text-warn-text">
              {d.contratsDepasses.length} logiciel{d.contratsDepasses.length > 1 ? "s" : ""} en
              dépassement de contrat
            </strong>{" "}
            <span className="text-muted">
              ({d.contratsDepasses.map((l) => l.nom).join(", ")}) — à régulariser au prochain
              renouvellement.
            </span>
          </span>
        </Link>
      ) : null}

      {/* Tuiles KPI. Toutes en `h-full`, et `auto-rows-fr` pour que les DEUX
          rangées de l'affichage étroit se valent : la rangée s'aligne alors sur
          la tuile la plus haute au lieu de monter en escalier — « Éditeurs » n'a
          pas de mention sous son libellé, « Tâches en retard » a un libellé qui
          passe à la ligne. */}
      <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          value={d.nbLogiciels}
          label="Logiciels"
          hint={`${d.nbEnProduction} en production`}
          icon={<Package className="h-5 w-5" />}
          href="/logiciels"
          className="h-full"
        />
        <Stat
          value={d.nbEditeurs}
          label="Éditeurs"
          tone="info"
          icon={<Building2 className="h-5 w-5" />}
          href="/editeurs"
          className="h-full"
        />
        <Stat
          value={fmtEuros.format(d.coutAnnuelTotal)}
          label="Coût annuel"
          hint="contrats et marchés"
          tone="ok"
          icon={<Euro className="h-5 w-5" />}
          href="/contrats"
          className="h-full"
        />
        <Stat
          value={d.tachesEnRetard.length}
          label="Tâches en retard"
          hint={`${d.tachesSous30j} à faire sous 30 j`}
          tone={d.tachesEnRetard.length > 0 ? "danger" : "muted"}
          icon={<ClipboardList className="h-5 w-5" />}
          href="/taches"
          className="h-full"
        />
      </div>

      {/* Deux COLONNES, et non trois cartes posées à la suite : ce qu'il y a à
          faire à gauche sur deux tiers, ce qui décrit le parc à droite sur un
          tiers. Rangées côte à côte, la grille plaçait les répartitions APRÈS
          les deux cartes de gauche, donc sur la deuxième rangée — laissant en
          haut à droite un vide de la hauteur des renouvellements, et étirant
          « Mes tâches » sur toute la hauteur de la colonne d'en face. */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {/* Renouvellements à venir */}
          {/* Titre calculé : la fenêtre suit le délai de rappel réglé en
              Administration › Messagerie, elle n'est plus figée à 60 jours. */}
          <Card title={`Contrats à renouveler (sous ${d.seuilRenouvellementJours} jours)`}>
            {d.renouvellements.length === 0 ? (
              <EmptyState>
                Aucun contrat à renouveler dans les {d.seuilRenouvellementJours} prochains jours.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {d.renouvellements.map((r) => (
                  <li
                    key={`${r.href}-${r.echeance.toISOString()}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <Link href={r.href} className="font-medium text-strong hover:text-accent">
                        {r.titre}
                      </Link>
                      <span className="block truncate text-xs text-muted">{r.detail}</span>
                    </span>
                    <span className="badge-warn shrink-0">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {fmtDate.format(r.echeance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Les certificats, sous les contrats : deux échéances de même nature
              — quelque chose expire et doit être commandé avant. La carte se
              tait quand il n'y a rien dans la fenêtre, comme celle des tâches :
              une liste vide occuperait une carte entière pour ne rien dire. */}
          {d.certificats.length > 0 ? (
            <Card
              title="Certificats à renouveler"
              hint={`sous ${d.seuilCertificatJours} jours, expirés compris`}
            >
              <ul className="divide-y divide-line text-sm">
                {d.certificats.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <Link
                        href={`/certificats/${c.id}`}
                        className="block truncate font-medium text-strong hover:text-accent"
                      >
                        {c.titulaire}
                      </Link>
                      <span className="block truncate text-xs text-muted">{c.detail}</span>
                    </span>
                    {/* Rouge pour ce qui est déjà périmé, ambre pour ce qui
                        vient : un certificat expiré n'est plus une échéance,
                        c'est une panne en attente. */}
                    <span className={c.expire ? "badge-danger shrink-0" : "badge-warn shrink-0"}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      {fmtDate.format(c.echeance)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Mes tâches : la seule carte de l'écran qui change d'un compte à
              l'autre. Elle se tait pour qui n'en porte aucune — annoncer une
              liste vide occuperait une carte entière pour ne rien dire.

              Sous les renouvellements et de la même largeur : les deux disent ce
              qu'il y a à FAIRE, quand les répartitions d'à côté ne font que
              décrire le parc. */}
          {d.mesTaches.length > 0 ? <MesTaches taches={d.mesTaches} /> : null}
        </div>

        {/* Répartitions */}
        <div className="space-y-3">
          <Card title="Par criticité">
            <BarreRepartition data={d.parCriticite} />
          </Card>
          <Card title="Par hébergement">
            <BarreRepartition data={d.parHebergement} />
          </Card>
          <Stat
            value={d.nbServeurs}
            label="Serveurs"
            tone="muted"
            icon={<Server className="h-5 w-5" />}
            href="/serveurs"
          />
        </div>
      </div>
    </>
  );
}
