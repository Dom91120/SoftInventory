import {
  AlertTriangle,
  Building2,
  CalendarClock,
  FileSignature,
  Package,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarresCategories } from "@/components/graphiques";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/server/guards";
import { chargerDashboard } from "@/server/services/dashboard";
import { TachesAFaire } from "./taches-a-faire";

export const metadata: Metadata = { title: "Tableau de bord" };

const fmtDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const fmtEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Une carte de statistique, cliquable EN ENTIER vers l'écran Statistiques : ce
 * qu'elle résume y est développé, et c'est la suite naturelle du regard — on
 * voit une répartition, on veut la voir en entier.
 *
 * La cible est la carte et non son seul titre : ces trois cartes n'ont qu'une
 * destination, et viser un mot de quatorze pixels pour y aller n'a pas de sens
 * quand tout ce qui l'entoure mène au même endroit. Les cartes de gauche, elles,
 * gardent leur titre-lien : leurs lignes mènent chacune ailleurs, une carte
 * entière cliquable y entrerait en concurrence avec elles.
 *
 * Le survol reprend celui des tuiles du haut — la carte se soulève : c'est ce
 * qui la dit cliquable, faute d'un libellé qui l'annonce.
 */
function CarteStats({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Link href="/statistiques" title="Voir les statistiques" className="group block">
      <Card
        title={title}
        hint={hint}
        className="transition group-hover:-translate-y-0.5 group-hover:shadow-md"
      >
        {children}
      </Card>
    </Link>
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
          moyenne — CINQ inventaires, cinq nombres d'objets, et un clic vers la
          liste de chacun. L'ordre est celui du menu, pour qu'on retrouve ici ce
          qu'on y cherche là.

          Deux tuiles ont occupé cette rangée avant de la quitter, chacune pour
          sa raison. « Tâches en retard » disait la même chose que la carte des
          tâches, qui liste les retards en tête et en rouge, et que le bandeau
          d'alerte ci-dessus, qui ne paraît QUE s'il y en a — elle affichait zéro
          le reste du temps. « Coût annuel » n'était pas un décompte mais une
          statistique : sa place est avec les répartitions, dans la colonne de
          droite.

          Trois largeurs, trois découpes : les CINQ de front quand la place le
          permet, puis TROIS PUIS DEUX — et non deux, deux, une : cinq tuiles
          tiennent mieux sur deux rangées que sur trois, et la seconde reste
          pleine à moitié plutôt que de laisser une tuile seule au bas. Sur un
          téléphone, deux par rangée : à trois, il ne resterait pas cinquante
          pixels au libellé une fois l'icône posée.

          Toutes en `h-full`, et `auto-rows-fr` pour que les rangées se valent :
          chacune s'aligne alors sur la tuile la plus haute au lieu de monter en
          escalier — une seule porte une mention sous son libellé, et
          « Contrats/Marchés » passe à la ligne. */}
      <div className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          // Le compte couvre TOUT l'annuaire ; la mention détaille ce qui n'y
          // est pas éditeur, et se tait tant que rien n'est requalifié.
          hint={
            [
              d.nbFournisseurs
                ? `${d.nbFournisseurs} fournisseur${d.nbFournisseurs > 1 ? "s" : ""}`
                : null,
              d.nbAutorites ? `${d.nbAutorites} autorité${d.nbAutorites > 1 ? "s" : ""}` : null,
            ]
              .filter(Boolean)
              .map((detail, i) => (i === 0 ? `dont ${detail}` : detail))
              .join(", ") || undefined
          }
          tone="info"
          icon={<Building2 className="h-5 w-5" />}
          href="/editeurs"
          className="h-full"
        />
        {/* Le libellé porte la barre oblique du menu et du titre de l'écran :
            trois façons de nommer la même chose auraient fait douter qu'il
            s'agisse de la même.

            Mais « Contrats/Marchés » n'a pas d'espace : le mot est insécable et
            le cadre le rognait au dernier caractère. Il interroge donc la place
            dont il dispose et change de forme — sur une ligne quand elle suffit,
            en DEUX MOTS EMPILÉS sinon, et la barre oblique s'efface alors : elle
            ne sépare plus rien, c'est le retour à la ligne qui s'en charge. */}
        <Stat
          value={d.nbContrats}
          label={
            <>
              <span className="block @[7.5rem]:inline">Contrats</span>
              <span className="hidden @[7.5rem]:inline">/</span>
              <span className="block @[7.5rem]:inline">Marchés</span>
            </>
          }
          tone="ok"
          icon={<FileSignature className="h-5 w-5" />}
          href="/contrats"
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
        {/* `min-w-0` sur les DEUX colonnes : une piste de grille se laisse
            déborder par le contenu minimal de son item — une date qu'on empêche
            de se couper, un libellé long — et les colonnes poussaient la page de
            seize pixels sur un téléphone. */}
        <div className="min-w-0 space-y-3 lg:col-span-2">
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
        <div className="min-w-0 space-y-3">
          {/* Les trois cartes mènent aux Statistiques, chacune EN ENTIER —
              voir `CarteStats`. */}
          <CarteStats title="Coût annuel" hint="contrats et marchés">
            <p className="font-mono text-[1.7rem] font-semibold leading-tight text-strong tabular-nums">
              {fmtEuros.format(d.coutAnnuelTotal)}
            </p>
          </CarteStats>
          <CarteStats title="Criticité">
            <BarresCategories data={d.parCriticite} />
          </CarteStats>
          <CarteStats title="Hébergement">
            <BarresCategories data={d.parHebergement} />
          </CarteStats>
        </div>
      </div>
    </>
  );
}
