import { LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { LIBELLES } from "@/schemas/logiciel";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";

export const metadata: Metadata = { title: "Serveurs" };

/**
 * Deux façons de lire le même parc :
 *
 * - CARTES, un encadré par serveur — on cherche un serveur et on lit ce qu'il
 *   porte, c'est la vue de celui qui intervient dessus ;
 * - LISTE, une rangée par serveur — l'OS et la localisation, noyés en petit
 *   gris dans les cartes, y deviennent des colonnes que l'œil descend d'un
 *   trait, et deux fois plus de serveurs tiennent à l'écran.
 *
 * Le choix vit dans l'URL (`?vue=liste`) plutôt que dans un état : la vue se
 * met en favori et se partage telle quelle, et la page reste rendue côté
 * serveur.
 */
const VUES = [
  { cle: "cartes", label: "Cartes", Icone: LayoutGrid },
  { cle: "liste", label: "Liste", Icone: List },
] as const;
type VueCle = (typeof VUES)[number]["cle"];

/**
 * Vue de LECTURE : quels logiciels tournent où. L'édition du référentiel des
 * serveurs se fait en Administration › Référentiels ; l'association
 * logiciel ↔ serveur sur la fiche du logiciel (onglet Liaisons).
 */
export default async function ServeursPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  await requireUser();
  const { vue } = await searchParams;
  // Tout ce qui n'est pas une vue connue retombe sur les cartes : une adresse
  // bricolée montre le parc, jamais une page vide.
  const active: VueCle = VUES.some((v) => v.cle === vue) ? (vue as VueCle) : "cartes";

  const serveurs = await prisma.serveur.findMany({
    orderBy: { nom: "asc" },
    include: {
      logiciels: {
        include: { logiciel: { select: { id: true, nom: true } } },
        orderBy: { logiciel: { nom: "asc" } },
      },
    },
  });

  /** Pastille d'environnement, commune aux deux vues. */
  const badgeEnv = (environnement: keyof typeof LIBELLES.environnement) => (
    <span className={environnement === "production" ? "badge-ok" : "badge-muted"}>
      {LIBELLES.environnement[environnement]}
    </span>
  );

  return (
    <>
      {/* Le sélecteur voyage dans les ACTIONS de l'en-tête, sur la ligne du
          titre : c'est là que l'œil cherche les commandes d'une page, et une
          rangée entière n'a pas à être dépensée pour deux liens. Il y est
          d'office à droite, l'en-tête écartant titre et actions.

          Encadré et porteur d'icônes, DÉLIBÉRÉMENT différent des onglets
          (`components/ui.tsx`) : un onglet change ce que la page montre, ce
          sélecteur change comment elle le montre, à contenu identique. Lui
          donner la forme d'un onglet ferait croire qu'on quitte la page. Deux
          liens et non deux boutons — la vue est une adresse. */}
      <PageHeader
        title="Serveurs"
        subtitle="Où les applications sont installées (association depuis la fiche de chaque logiciel)"
        actions={
          <div className="flex items-center gap-0.5 rounded-lg border border-sub bg-surface p-0.5">
            {VUES.map(({ cle, label, Icone }) => (
              <Link
                key={cle}
                href={`?vue=${cle}`}
                aria-current={cle === active ? "page" : undefined}
                title={`Affichage en ${label.toLowerCase()}`}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition ${
                  cle === active ? "bg-inset text-strong" : "text-muted hover:text-strong"
                }`}
              >
                <Icone className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        }
      />

      {serveurs.length === 0 ? (
        <EmptyState>
          Aucun serveur dans le référentiel — un admin peut en ajouter depuis Administration ›
          Référentiels › Serveurs.
        </EmptyState>
      ) : active === "liste" ? (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            {/* `table-fixed` : les largeurs déclarées font loi, et c'est ce qui
                déclenche la troncature des cellules qu'on empêche de se couper.
                La colonne des logiciels garde la part du lion — c'est la seule
                dont le contenu varie d'un serveur à l'autre. */}
            <table className="data-table table-fixed">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "44%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Serveur</th>
                  <th>OS</th>
                  <th>Localisation</th>
                  <th>Logiciels installés</th>
                </tr>
              </thead>
              <tbody>
                {serveurs.map((s) => (
                  // Hauteur plancher et non fixe : un serveur qui porte cinq
                  // logiciels prend la ligne qu'il lui faut, les autres gardent
                  // le pas régulier de la liste des logiciels.
                  <tr key={s.id} className="h-12">
                    <td>
                      <span className="block truncate font-medium text-strong" title={s.nom}>
                        {s.nom}
                      </span>
                    </td>
                    {/* Un tiret plutôt qu'une case vide : la colonne existe,
                        c'est le renseignement qui manque. */}
                    <td>
                      <span className="block truncate text-muted" title={s.os}>
                        {s.os || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="block truncate text-muted" title={s.localisation}>
                        {s.localisation || "—"}
                      </span>
                    </td>
                    <td>
                      {s.logiciels.length === 0 ? (
                        <span className="text-faint">Aucun logiciel associé.</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {s.logiciels.map((ls) => (
                            <span
                              key={`${ls.logicielId}-${ls.environnement}`}
                              className="inline-flex items-center gap-1.5"
                            >
                              <Link
                                href={`/logiciels/${ls.logiciel.id}`}
                                className="font-medium text-strong hover:text-accent"
                              >
                                {ls.logiciel.nom}
                              </Link>
                              {badgeEnv(ls.environnement)}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-x-3 gap-y-2 lg:grid-cols-2">
          {serveurs.map((s) => (
            <section key={s.id} className="card px-5 py-4">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-strong">{s.nom}</h2>
                <span className="text-xs text-faint">
                  {[s.os, s.localisation].filter(Boolean).join(" · ")}
                </span>
              </div>
              {s.logiciels.length === 0 ? (
                <p className="text-sm text-faint">Aucun logiciel associé.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {s.logiciels.map((ls) => (
                    <li
                      key={`${ls.logicielId}-${ls.environnement}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <Link
                        href={`/logiciels/${ls.logiciel.id}`}
                        className="font-medium text-strong hover:text-accent"
                      >
                        {ls.logiciel.nom}
                      </Link>
                      {badgeEnv(ls.environnement)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
