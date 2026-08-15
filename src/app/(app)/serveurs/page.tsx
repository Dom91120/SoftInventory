import { LayoutGrid, List, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { LIBELLES } from "@/schemas/logiciel";
import { LIBELLES_TYPE_OS } from "@/schemas/serveur";
import { requireUser } from "@/server/guards";
import { listServeursAvecLogiciels } from "@/server/services/serveurs";

export const metadata: Metadata = { title: "Serveurs" };

/**
 * Deux façons de lire le même parc :
 *
 * - LISTE, une rangée par serveur — l'OS et la localisation, noyés en petit
 *   gris dans les cartes, y deviennent des colonnes que l'œil descend d'un
 *   trait, et deux fois plus de serveurs tiennent à l'écran. C'est la vue
 *   D'OFFICE : on arrive ici pour retrouver une machine dans le parc, et une
 *   colonne se balaie plus vite qu'une mosaïque ;
 * - CARTES, un encadré par serveur — on lit alors ce qu'une machine porte,
 *   c'est la vue de celui qui intervient dessus.
 *
 * Le choix vit dans l'URL (`?vue=cartes`) plutôt que dans un état : la vue se
 * met en favori et se partage telle quelle, et la page reste rendue côté
 * serveur.
 */
const VUES = [
  { cle: "liste", label: "Liste", Icone: List },
  { cle: "cartes", label: "Cartes", Icone: LayoutGrid },
] as const;
type VueCle = (typeof VUES)[number]["cle"];

/**
 * L'écran des serveurs : on y lit quels logiciels tournent où, ET on y tient le
 * parc — créer une machine, la modifier, la supprimer. Ces trois gestes vivaient
 * en Administration › Référentiels, où un serveur n'était qu'une ligne de liste
 * de valeurs ; ils sont ici, sur l'écran qui porte le nom de la chose.
 *
 * L'association logiciel ↔ serveur, elle, reste sur la fiche du LOGICIEL (onglet
 * Liaisons) : c'est le logiciel qu'on installe, pas le serveur qu'on garnit.
 */
export default async function ServeursPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const { vue } = await searchParams;
  // Tout ce qui n'est pas « cartes » retombe sur la liste : une adresse
  // bricolée montre le parc, jamais une page vide.
  const active: VueCle = vue === "cartes" ? "cartes" : "liste";

  const serveurs = await listServeursAvecLogiciels();

  /** Pastille d'environnement, commune aux deux vues. */
  const badgeEnv = (environnement: keyof typeof LIBELLES.environnement) => (
    <span className={environnement === "production" ? "badge-ok" : "badge-muted"}>
      {LIBELLES.environnement[environnement]}
    </span>
  );

  return (
    <>
      {/* La ligne du titre porte la COMMANDE de l'écran — ajouter une machine —
          comme sur les autres listes de l'inventaire. Le « + » dit qu'on
          ajoute, le libellé n'a plus qu'à nommer ce qu'on ajoute. */}
      <PageHeader
        title="Serveurs"
        subtitle="Le parc et ce qui y tourne (les installations se déclarent depuis la fiche de chaque logiciel)"
        actions={
          isAdmin ? (
            <Link href="/serveurs/nouveau" className="btn-primary" title="Nouveau serveur">
              <Plus className="h-4 w-4" />
              Serveur
            </Link>
          ) : undefined
        }
      />

      {/* Le sélecteur de vue descend au NIVEAU DES ONGLETS : sous l'en-tête, sur
          le filet qui court d'un bord à l'autre, au bout de la rangée. La ligne
          du titre appartient aux commandes ; changer de vue n'en est pas une, et
          la place qu'il y occupait revient au bouton d'ajout.

          Il garde sa forme encadrée, DÉLIBÉRÉMENT différente des onglets
          (`components/ui.tsx`) : un onglet change ce que la page montre, ce
          sélecteur change comment elle le montre, à contenu identique. Lui
          donner la forme d'un onglet ferait croire qu'on quitte la page. Deux
          liens et non deux boutons — la vue est une adresse.

          SANS le filet des barres d'onglets : il annonce une bascule de contenu,
          et il n'y en a pas ici — la page montre la même chose des deux côtés.
          Le cadre du sélecteur se suffit, et le trait faisait doublon avec celui
          que porte déjà le haut de la carte qui suit. */}
      <div className="mb-3 flex items-end justify-end">
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
      </div>

      {serveurs.length === 0 ? (
        <EmptyState>
          Aucun serveur pour l'instant.
          {isAdmin ? " Créez le premier avec le bouton « + Serveur »." : ""}
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
                <col style={{ width: "12%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "48%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Serveur</th>
                  {/* La colonne garde son titre d'origine — c'est « l'OS » qu'on
                      cherche des yeux — mais donne la FAMILLE du système et non
                      sa version : « Windows » se balaie d'un trait sur quinze
                      lignes, « Windows Server 2022 » demande qu'on le lise. La
                      version exacte reste sur la fiche, où l'on va quand on la
                      cherche. */}
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
                    {/* Le nom mène à SA fiche, où le serveur se modifie et se
                        supprime — même geste que sur les listes de logiciels,
                        d'éditeurs et de marchés. */}
                    <td>
                      <Link
                        href={`/serveurs/${s.id}`}
                        title={s.nom}
                        className="block truncate font-medium text-strong hover:text-accent"
                      >
                        {s.nom}
                      </Link>
                    </td>
                    {/* Un tiret plutôt qu'une case vide : la colonne existe,
                        c'est le renseignement qui manque. */}
                    <td>
                      <span className="block truncate text-muted">
                        {s.typeOs ? LIBELLES_TYPE_OS[s.typeOs] : "—"}
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
            <section key={s.id} className="card">
              {/* Le nom du serveur devient un EN-TÊTE DE PANNEAU, dans la forme
                  exacte des cartes de fiche (`card-header` + `card-title`,
                  `globals.css`) : même barre d'accent, même hauteur plancher,
                  même titre en petites capitales. Le `pl-7` dégage la barre.
                  La liste, elle, reste sans filets : deux logiciels du même
                  serveur n'ont pas à être séparés l'un de l'autre. */}
              <header className="card-header pl-7">
                {/* Le titre de la carte EST le lien vers la fiche, plutôt qu'une
                    commande de plus à sa droite : c'est le nom qu'on vise quand
                    on veut corriger un OS ou une localisation.

                    Il porte l'habillage des NOMS D'OBJETS de l'inventaire —
                    celui des logiciels juste en dessous — et non le petit
                    capitale grise de `card-title` : ces deux lignes nomment des
                    choses de même rang, un serveur et ce qui tourne dessus, et
                    l'une menait à sa fiche en ayant l'air d'un intitulé de
                    rubrique. L'en-tête garde sa barre d'accent et sa hauteur. */}
                <h2 className="shrink-0 text-sm font-medium">
                  <Link
                    href={`/serveurs/${s.id}`}
                    className="text-strong transition hover:text-accent"
                  >
                    {s.nom}
                  </Link>
                </h2>
                {/* Le TYPE seul, comme la colonne de la liste — et rien d'autre :
                    la localisation n'a rien à faire là où l'on regarde ce qu'une
                    machine porte, et elle se lit dans l'autre vue. Rien quand le
                    type n'est pas renseigné : un tiret tient une colonne, pas une
                    ligne de méta. */}
                <span className="min-w-0 truncate text-xs text-faint">
                  {s.typeOs ? LIBELLES_TYPE_OS[s.typeOs] : ""}
                </span>
              </header>
              <div className="card-body">
                {s.logiciels.length === 0 ? (
                  <p className="text-sm text-faint">Aucun logiciel associé.</p>
                ) : (
                  <ul className="text-sm">
                    {s.logiciels.map((ls) => (
                      <li
                        key={`${ls.logicielId}-${ls.environnement}`}
                        className="flex items-center justify-between gap-3 py-1.5"
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
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
