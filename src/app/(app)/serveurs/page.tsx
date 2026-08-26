import { LayoutGrid, List, Plus } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { BarreListe } from "@/components/barre-liste";
import { Pagination, pageInitiale, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { LIBELLES_TYPE_OS, TYPES_OS } from "@/schemas/serveur";
import { requireUser } from "@/server/guards";
import { listServeursAvecLogiciels } from "@/server/services/serveurs";
import { MemoireVue } from "./memoire-vue";

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
 * serveur. Quand l'URL se tait, un cookie ressert la dernière vue affichée
 * (voir `MemoireVue`) — revenir sur l'écran ne défait pas le choix qu'on y
 * avait fait.
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
  searchParams: Promise<{ vue?: string; page?: string; q?: string; os?: string }>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const params = await searchParams;
  // L'URL d'abord, le cookie ensuite, la liste enfin : une adresse explicite
  // (`?vue=…`) fait loi, une adresse nue ressert la dernière vue affichée, et
  // tout ce qui n'est ni « cartes » ni un souvenir retombe sur la liste — une
  // adresse bricolée montre le parc, jamais une page vide.
  const memoVue = (await cookies()).get("vue-serveurs")?.value;
  const active: VueCle =
    params.vue === "cartes" || (params.vue === undefined && memoVue === "cartes")
      ? "cartes"
      : "liste";

  // Dix par page en LISTE, comme les listes de logiciels, d'éditeurs et de
  // marchés. Les CARTES, elles, montrent tout le parc d'un coup : c'est la vue
  // d'ensemble de qui porte quoi, la feuilleter par tranches de dix la casserait.
  // Filtre validé contre la liste des clés : une valeur forgée dans l'URL est
  // simplement ignorée — même geste que la catégorie des éditeurs.
  const typeOs = TYPES_OS.find((t) => t === params.os);
  const tous = await listServeursAvecLogiciels({ q: params.q, typeOs });
  const { page, pages, total, elements } = paginer(tous, await pageInitiale(params, "/serveurs"));
  const serveurs = active === "liste" ? elements : tous;
  /** L'adresse d'une vue garde la recherche, le filtre et la page en cours. */
  const hrefVue = (cle: VueCle) => {
    const qs = new URLSearchParams();
    qs.set("vue", cle);
    if (params.q) qs.set("q", params.q);
    if (typeOs) qs.set("os", typeOs);
    if (page > 1) qs.set("page", String(page));
    return `?${qs.toString()}`;
  };

  return (
    <>
      {/* Note la vue affichée pour la ressortir à la prochaine adresse nue. */}
      <MemoireVue vue={active} />
      {/* La ligne du titre porte la COMMANDE de l'écran — ajouter une machine —
          comme sur les autres listes de l'inventaire. Le « + » dit qu'on
          ajoute, le libellé n'a plus qu'à nommer ce qu'on ajoute. */}
      <PageHeader
        title="Serveurs"
        subtitle="Le parc et ce qui y tourne"
        actions={
          isAdmin ? (
            <Link href="/serveurs/nouveau" className="btn-primary" title="Nouveau serveur">
              <Plus className="h-4 w-4" />
              Serveur
            </Link>
          ) : undefined
        }
      />

      {/* La barre des listes — recherche, famille d'OS, export — comme sur les
          éditeurs et les marchés : la page n'en avait pas, et un parc de
          vingt-six machines se cherche déjà. Le sélecteur de vue ferme la
          rangée, au bout, après l'export.

          Il garde sa forme encadrée, DÉLIBÉRÉMENT différente des onglets
          (`components/ui.tsx`) : un onglet change ce que la page montre, ce
          sélecteur change comment elle le montre, à contenu identique. Lui
          donner la forme d'un onglet ferait croire qu'on quitte la page. Deux
          liens et non deux boutons — la vue est une adresse. */}
      <BarreListe
        rechercheLabel="Rechercher un serveur ou un logiciel installé"
        exportHref="/serveurs/export"
        selects={[
          {
            key: "os",
            label: "OS",
            options: TYPES_OS.map((t) => ({ value: t, label: LIBELLES_TYPE_OS[t] })),
          },
        ]}
        actions={
          <div className="flex items-center gap-0.5 rounded-lg border border-sub bg-surface p-0.5">
            {/* La page en cours suit le changement de vue : les deux montrent
                le même parc dans le même ordre, on regarde donc la même tranche
                autrement — retomber à la première serait perdre sa place. */}
            {VUES.map(({ cle, label, Icone }) => (
              <Link
                key={cle}
                href={hrefVue(cle)}
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

      {total === 0 ? (
        <EmptyState>
          {params.q || typeOs
            ? "Aucun serveur ne correspond à cette recherche."
            : `Aucun serveur pour l'instant.${isAdmin ? " Créez le premier avec le bouton « + Serveur »." : ""}`}
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
                <col style={{ width: "18%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "70%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Serveur</th>
                  <th>Emplacement</th>
                  <th>Logiciels installés</th>
                </tr>
              </thead>
              <tbody>
                {serveurs.map((s) => (
                  // Hauteur plancher et non fixe : un serveur qui porte cinq
                  // logiciels prend la ligne qu'il lui faut, les autres gardent
                  // le pas régulier de la liste des logiciels. Le rembourrage
                  // vertical des cellules saute pour que ce plancher de 48 px
                  // soit tenu tel quel — même geste que la liste des éditeurs.
                  <tr key={s.id} className="h-12 [&>td]:py-0">
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
                      {/* L'OS en SOUS-TITRE du nom plutôt qu'en colonne : la
                          FAMILLE du système (« Windows », pas sa version — la
                          version exacte reste sur la fiche) qualifie la machine
                          plus qu'elle ne se compare d'une ligne à l'autre. Rien
                          quand il n'est pas renseigné : un tiret tient une
                          colonne, pas une ligne de sous-titre — même geste que
                          les cartes. */}
                      {s.typeOs && (
                        <span className="block truncate text-xs text-faint">
                          {LIBELLES_TYPE_OS[s.typeOs]}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className="block truncate font-medium text-strong"
                        title={s.localisation}
                      >
                        {s.localisation || "—"}
                      </span>
                    </td>
                    <td>
                      {s.logiciels.length === 0 ? (
                        <span className="text-faint">Aucun logiciel associé.</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-5 gap-y-0">
                          {s.logiciels.map((ls) => (
                            <Link
                              key={ls.logicielId}
                              href={`/logiciels/${ls.logiciel.id}`}
                              className="font-medium text-strong hover:text-accent"
                            >
                              {ls.logiciel.nom}
                            </Link>
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
            /* `flex flex-col` + `grow` sur le corps + `h-full` sur la grille :
               la grille des cartes égalise les hauteurs d'une rangée de
               cartes, et cette chaîne fait descendre les filets verticaux
               jusqu'en bas du corps — sans elle, le trait d'une carte courte
               s'arrêtait à sa ligne de texte quand sa voisine la dépassait. */
            <section key={s.id} className="card flex flex-col">
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
              <div className="card-body grow">
                {s.logiciels.length === 0 ? (
                  <p className="text-sm text-faint">Aucun logiciel associé.</p>
                ) : (
                  /* Trois tiers fixes plutôt qu'un flux : les noms s'alignent en
                     colonnes d'une carte à l'autre, et une machine chargée se
                     lit ligne à ligne. Un nom plus large que son tiers se
                     tronque — le titre complet est à un survol ou un clic.

                     Trois PILES et non une grille en rangées : chaque tiers
                     empile ses logiciels (le 1er, le 4e… dans la première, même
                     ordre visuel qu'une grille) et les centre verticalement —
                     un nom seul dans sa colonne se pose au milieu du corps au
                     lieu de rester collé en haut quand la carte est plus haute
                     que lui. L'ordre de lecture reste ligne à ligne. */
                  <div className="relative grid h-full grid-cols-3 text-[13px]">
                    {/* Les filets verticaux sont posés en absolu sur toute la
                        hauteur : ils traversent rangées et interlignes d'un
                        seul trait, là où une bordure de cellule s'arrêtait à sa
                        rangée. Le second attend le deuxième logiciel : chaque
                        tiers occupé est borné à sa droite, mais un logiciel
                        seul n'a pas à traîner deux traits derrière lui. */}
                    <span aria-hidden className="absolute inset-y-0 left-1/3 w-px bg-sub" />
                    {s.logiciels.length >= 2 && (
                      <span aria-hidden className="absolute inset-y-0 left-2/3 w-px bg-sub" />
                    )}
                    {[0, 1, 2].map((colonne) => (
                      <ul
                        key={colonne}
                        className="flex min-w-0 flex-col justify-center gap-y-1.5 px-2"
                      >
                        {s.logiciels
                          .filter((_, i) => i % 3 === colonne)
                          .map((ls) => (
                            <li key={ls.logicielId} className="min-w-0 text-center">
                              <Link
                                href={`/logiciels/${ls.logiciel.id}`}
                                title={ls.logiciel.nom}
                                className="block truncate font-medium text-strong hover:text-accent"
                              >
                                {ls.logiciel.nom}
                              </Link>
                            </li>
                          ))}
                      </ul>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      {/* Le pavé des autres listes, à la même place — mais sous la LISTE
          seulement : les cartes montrent déjà tout, il n'y a rien à feuilleter. */}
      {active === "liste" && <Pagination page={page} pages={pages} total={total} params={params} />}
    </>
  );
}
