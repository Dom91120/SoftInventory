import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Package,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/server/guards";
import { chargerDashboard, type Repartition } from "@/server/services/dashboard";
import { TachesAFaire } from "./taches-a-faire";

export const metadata: Metadata = { title: "Tableau de bord" };

const fmtDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const fmtEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Répartition en BARRES, une par catégorie. Rendue côté serveur, sans
 * bibliothèque : quelques div et des pourcentages suffisent.
 *
 * Une barre empilée occupait cette place. Elle convient à une composition de
 * deux à quatre postes équilibrés ; elle échouait ici, où la criticité met 87 %
 * sur un seul poste et laisse quatre miettes à 2 %, réduites à des traits de
 * sept pixels qu'on ne pouvait ni voir ni comparer entre eux. Le camembert
 * aurait fait pire : l'œil compare mal les angles.
 *
 * Et l'information s'écrivait DEUX FOIS — la barre, puis la légende qui la
 * traduisait. Ici la légende EST le graphique : chaque catégorie porte son
 * libellé, sa valeur et sa barre sur sa propre ligne. Un poste à 1 % s'y lit
 * aussi bien qu'un poste à 87 %.
 *
 * Le rail gris derrière chaque barre figure le total : on lit donc les deux
 * choses à la fois, la comparaison entre catégories (longueurs entre elles) et
 * la part de chacune dans l'ensemble (longueur sur son rail).
 *
 * L'ordre reste celui du RÉFÉRENTIEL et n'est pas trié par valeur : la
 * criticité est une échelle — faible, modérée, élevée, critique — et la ranger
 * par effectif ferait perdre la progression qu'elle porte.
 */
function BarreRepartition({ data }: { data: Repartition }) {
  const total = data.reduce((s, d) => s + d.nb, 0);
  if (total === 0) return <p className="text-sm text-faint">Aucune donnée.</p>;
  const part = (nb: number) => (nb / total) * 100;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label}>
          {/* Libellé et valeur au-dessus de la barre, et non à ses côtés : la
              colonne ne fait qu'un tiers de l'écran, et les trois sur une même
              ligne n'auraient laissé à la barre que quelques dizaines de
              pixels — trop peu pour qu'une longueur veuille dire quelque
              chose. */}
          {/* Le POURCENTAGE se range avec le libellé, le COMPTE reste seul à
              droite. Les deux nombres côte à côte formaient un bloc où l'œil
              devait trancher lequel était lequel ; séparés, la droite devient
              une colonne de comptes alignés qu'on balaie d'un regard, et le
              pourcentage redevient ce qu'il est — une précision sur la
              catégorie, pas une donnée à comparer. */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-muted">
              {d.label}
              <span className="text-faint"> · {Math.round(part(d.nb))} %</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-strong tabular-nums">{d.nb}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-inset">
            {/* `min-width` : un poste à une unité sur cent ferait moins d'un
                pixel et disparaîtrait, alors que sa ligne l'annonce juste
                au-dessus — la barre mentirait par omission. */}
            <div
              className="h-full min-w-[3px] rounded-full"
              style={{ width: `${part(d.nb)}%`, background: d.couleur }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function TableauDeBordPage() {
  // La session est exigée pour l'ACCÈS, pas pour le contenu : l'écran est le
  // même pour tous, il décrit le parc et non ce qu'on demande à chacun.
  await requireUser();
  const d = await chargerDashboard();

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

      {/* Tuiles KPI, les CINQ sur une rangée à parts égales : COMBIEN de quoi
          la collectivité dispose. Rien d'autre : ni échéance, ni montant, ni
          moyenne — QUATRE inventaires, quatre nombres d'objets, et un clic vers
          la liste de chacun.

          Deux tuiles ont occupé cette rangée avant de la quitter, chacune pour
          sa raison. « Tâches en retard » disait la même chose que la carte des
          tâches, qui liste les retards en tête et en rouge, et que le bandeau
          d'alerte ci-dessus, qui ne paraît QUE s'il y en a — elle affichait zéro
          le reste du temps. « Coût annuel » n'était pas un décompte mais une
          statistique : sa place est avec les répartitions, dans la colonne de
          droite.

          Toutes en `h-full`, et `auto-rows-fr` pour que les rangées de
          l'affichage étroit se valent : chacune s'aligne alors sur la tuile la
          plus haute au lieu de monter en escalier — trois d'entre elles n'ont
          pas de mention sous leur libellé. */}
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
          value={d.nbServeurs}
          label="Serveurs"
          tone="muted"
          icon={<Server className="h-5 w-5" />}
          href="/serveurs"
          className="h-full"
        />
        <Stat
          value={d.nbCertificats}
          label="Certificats"
          tone="info"
          icon={<ShieldCheck className="h-5 w-5" />}
          href="/certificats"
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

          {/* Les tâches du parc, celles de tout le monde. La carte se tait quand
              il n'y en a aucune d'active — annoncer une liste vide occuperait
              une carte entière pour ne rien dire.

              Sous les renouvellements et de la même largeur : les trois disent
              ce qu'il y a à FAIRE, quand les répartitions d'à côté ne font que
              décrire le parc. */}
          {d.taches.length > 0 ? <TachesAFaire taches={d.taches} /> : null}
        </div>

        {/* Statistiques : ce que le parc coûte, et comment il se répartit. Le
            coût ouvre la colonne parce qu'il est le seul chiffre unique parmi
            des distributions — et qu'il n'avait rien à faire dans la rangée du
            haut, où les autres tuiles comptent des objets.

            Il a la forme de ses voisines — une carte à barre d'accent — et non
            celle des tuiles du haut : la forme dit à quel groupe on appartient,
            et il appartient désormais à celui-ci. Seul le chiffre garde la
            typographie des tuiles, pour que les montants de l'écran se lisent
            tous de la même façon. */}
        <div className="space-y-3">
          <Card title="Coût annuel" hint="contrats et marchés">
            <Link
              href="/contrats"
              title="Voir les contrats et marchés"
              className="block font-mono text-[1.7rem] font-semibold leading-tight text-strong tabular-nums transition hover:text-accent"
            >
              {fmtEuros.format(d.coutAnnuelTotal)}
            </Link>
          </Card>
          <Card title="Criticité">
            <BarreRepartition data={d.parCriticite} />
          </Card>
          <Card title="Hébergement">
            <BarreRepartition data={d.parHebergement} />
          </Card>
        </div>
      </div>
    </>
  );
}
