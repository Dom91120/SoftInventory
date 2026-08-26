import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarreListe } from "@/components/barre-liste";
import { Pagination, pageInitiale, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC, formatEuros } from "@/lib/format";
import { dateCalendaire } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { requireUser } from "@/server/guards";
import {
  etatMarche,
  listContrats,
  SENS_PAR_DEFAUT,
  type TriContrat,
  titreDe,
  trierContrats,
} from "@/server/services/contrats";
import { listEditeurs } from "@/server/services/editeurs";
import { filtresContratsDepuisParams, queryTri, triContratsDepuisParams } from "./shared";

export const metadata: Metadata = { title: "Contrats/Marchés" };

/**
 * Les deux bornes du marché, destinées à être empilées : début puis fin. Sans
 * « du » ni « au » — la colonne s'appelle « Période », et deux dates l'une sous
 * l'autre se lisent dans cet ordre sans qu'on ait à le dire ; les mots coûtaient
 * une demi-colonne pour cela seul.
 *
 * La borne inconnue garde sa ligne, marquée d'un tiret : sans elle, on ne
 * saurait plus laquelle des deux on lit. Renvoie null quand aucune n'est saisie.
 */
function periodeDe(debut: Date | null, fin: Date | null): { debut: string; fin: string } | null {
  if (!debut && !fin) return null;
  const f = (d: Date | null) => (d ? DATE_FMT_FR_UTC.format(d) : "—");
  return { debut: f(debut), fin: f(fin) };
}

/**
 * Tous les marchés de la collectivité, toutes fiches confondues — l'écran qui
 * répond à « quels engagements avons-nous ? », que l'onglet d'un logiciel ne
 * peut pas donner puisqu'il n'en montre qu'une part.
 */
export default async function ContratsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const params = await searchParams;
  const [bruts, fournisseurs, { contrat: seuilJours }] = await Promise.all([
    listContrats(filtresContratsDepuisParams(params)),
    listEditeurs(),
    seuilsRappel(),
  ]);

  // Même horizon que les rappels par e-mail et le tableau de bord : la pastille
  // « À renouveler » paraît quand le cron s'apprête à écrire. Calculé AVANT le
  // tri, qui en a besoin pour ordonner la colonne État.
  const aujourdhui = dateCalendaire(new Date());
  const limite = new Date(aujourdhui.getTime() + seuilJours * 86_400_000);

  const { tri, sens } = triContratsDepuisParams(params);
  const tous = trierContrats(bruts, tri, sens, aujourdhui, limite);
  /** L'ordre voyage avec le lien : les flèches de la fiche suivront celui-ci. */
  const qTri = queryTri(params);
  const {
    page,
    pages,
    total,
    elements: contrats,
  } = paginer(tous, await pageInitiale(params, "/contrats"));

  /**
   * En-tête cliquable. Le tri vit dans l'URL, donc un simple lien suffit : pas
   * d'état client, la page est rechargeable et l'ordre se partage avec elle.
   * Cliquer la colonne DÉJÀ triée inverse le sens ; en cliquer une autre part
   * du sens qui répond à la question qu'on se pose en la cliquant.
   *
   * `page` est retirée au passage : après un changement d'ordre, la page 4 ne
   * montre plus ce qu'elle montrait, et on attend le début de la liste.
   */
  const enTete = (cle: TriContrat, libelle: string, classe?: string) => {
    const actif = tri === cle;
    const suivant = actif ? (sens === "asc" ? "desc" : "asc") : SENS_PAR_DEFAUT[cle];
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    );
    qs.set("tri", cle);
    qs.set("sens", suivant);
    qs.delete("page");
    const Fleche = sens === "asc" ? ChevronUp : ChevronDown;
    return (
      <th
        className={classe}
        aria-sort={actif ? (sens === "asc" ? "ascending" : "descending") : "none"}
      >
        <Link
          href={`/contrats?${qs.toString()}`}
          scroll={false}
          className={`inline-flex items-center gap-1 hover:text-strong ${actif ? "text-strong" : ""}`}
          title={`Trier par ${libelle.toLowerCase()}`}
        >
          {libelle}
          {actif ? <Fleche className="h-3 w-3" /> : null}
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageHeader
        title="Contrats/Marchés"
        subtitle={`${total} contrat${total > 1 ? "s" : ""} ou marché${total > 1 ? "s" : ""}`}
        actions={
          isAdmin ? (
            // Le « + » dit déjà qu'on ajoute : le libellé n'a plus qu'à nommer
            // ce qu'on ajoute. Autant de gagné sur un écran de téléphone, où
            // l'en-tête et le bouton se disputent la ligne.
            <Link href="/contrats/nouveau" className="btn-primary" title="Nouveau marché">
              <Plus className="h-4 w-4" />
              Marché
            </Link>
          ) : undefined
        }
      />
      <BarreListe
        rechercheLabel="Rechercher un contrat ou marché"
        exportHref="/contrats/export"
        selects={[
          {
            key: "fournisseur",
            label: "Fournisseur",
            options: fournisseurs.map((f) => ({ value: String(f.id), label: f.nom })),
          },
        ]}
      />
      {total === 0 ? (
        <EmptyState>
          {params.q || params.fournisseur
            ? "Aucun contrat ni marché ne correspond."
            : `Aucun contrat ni marché pour l'instant.${isAdmin ? " Créez le premier avec le bouton « + Marché »." : ""}`}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            {/* `table-fixed` : le marché et le fournisseur se coupent en « … »
                plutôt que de se replier, et une cellule qu'on empêche de se
                couper élargit sa colonne en disposition automatique — les
                largeurs ci-dessous n'auraient plus été que des vœux. */}
            <table className="data-table table-fixed">
              {/* Les six parts font 100 : en disposition fixe, une colonne qui
                  se tait prendrait ce qui reste à parts égales avec les autres
                  muettes, ce qui donnerait autant de place à « État » qu'au
                  libellé d'un marché.

                  Le MARCHÉ prend le tiers : c'est la colonne qui NOMME la ligne,
                  et la seule dont on lise le texte en entier.

                  Trois colonnes ont une largeur ABSOLUE, parce que leur contenu
                  a une longueur CONNUE et qu'une part du tableau les aurait
                  repliées en deux dès que la fenêtre rétrécit. Ce sont aussi
                  celles dont on compare les valeurs d'une ligne à l'autre, et
                  une valeur coupée s'y lit de travers. Les trois largeurs sont
                  mesurées, pas estimées : chaque chaîne a été rendue dans la
                  fonte de sa cellule.

                  Le MONTANT : 6.25rem, soit 100 px. Dans la fonte de la cellule
                  (12 px, chiffres à chasse fixe), « 999 999,99 € » mesure 73 px
                  et « 9 999 999,99 € » 83 px ; la cellule pousse 12 px à sa
                  droite. La colonne tient donc le million comme la dizaine de
                  millions, sans que sa largeur dépende du plus gros montant
                  saisi ce jour-là.

                  La PÉRIODE : 5rem, soit 80 px. Ses deux dates sont empilées,
                  donc une seule compte, et « 31/12/2028 » mesure 66 px — la
                  fonte donnant la même largeur à tous les chiffres, aucune date
                  ne dépasse. Avec les 12 px de la cellule, il faut 78 px.

                  L'ÉTAT : 90 px, la mesure exacte de sa pastille la plus large,
                  « À renouveler » — 70 px de texte et 20 px de rembourrage. Sa
                  cellule ne pousse rien à sa droite, étant centrée (voir son
                  en-tête) : les 104 px qu'elle prenait avant comptaient ces
                  12 px, plus 2 de battement. En part, elle tombait à 45 px sur
                  un tableau étroit et la pastille sortait de sa colonne.

                  Les trois autres se partagent ce qui reste : leurs parts font
                  100 à elles seules, le navigateur les réduit d'autant que les
                  fixes ont pris. Elles gardent ainsi leur rapport entre elles à
                  toutes les largeurs, et ce sont les trois qui se coupent en
                  « … » — ce qu'elles perdent est à portée de survol.

                  Ce que la période et l'état ont rendu — une centaine de pixels
                  sur un tableau de 1000 — va au FOURNISSEUR, et à lui seul : le
                  marché et les logiciels gardent la largeur qu'ils avaient. Les
                  raisons sociales sont longues, « Ressources Consultants
                  Finances » se coupait quand les dates avaient de la place à ne
                  rien dire. */}
              <colgroup>
                <col style={{ width: "43%" }} />
                <col style={{ width: "37%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "5rem" }} />
                <col style={{ width: "6.25rem" }} />
                <col style={{ width: "90px" }} />
              </colgroup>
              {/* Les six colonnes se trient au clic — voir `enTete`. */}
              <thead>
                <tr>
                  {enTete("marche", "Marché")}
                  {enTete("fournisseur", "Fournisseur")}
                  {enTete("logiciels", "Logiciels couverts")}
                  {enTete("periode", "Période", "text-center")}
                  {enTete("montant", "Mnt annuel", "text-right")}
                  {/* `pr-0` : les cellules poussent toutes 12 px à leur droite,
                      et une colonne centrée dans sa boîte de contenu se retrouve
                      6 px à gauche du milieu de la colonne. L'état est la
                      dernière colonne, elle n'a pas de voisine à écarter. */}
                  {enTete("etat", "État", "pr-0 text-center")}
                </tr>
              </thead>
              <tbody>
                {contrats.map((c) => {
                  const etat = etatMarche(c.dateFin, aujourdhui, limite);
                  const montant = formatEuros(
                    c.montantAnnuel === null ? null : String(c.montantAnnuel),
                  );
                  const periode = periodeDe(c.dateDebut, c.dateFin);
                  return (
                    // Même pas que la liste des logiciels : 48 px, quoi que
                    // portent les cellules. Les rangées allaient de 39 à 47 px
                    // selon qu'un marché avait ou non une référence sous son
                    // libellé, et l'œil perdait le pas en descendant la liste.
                    <tr key={c.id} className="h-12">
                      {/* Le libellé d'abord — il dit de quoi il s'agit —, la
                          référence en dessous : même hiérarchie que l'en-tête
                          de la fiche. `titreDe` retombe sur la référence quand
                          le libellé manque, auquel cas la seconde ligne n'a
                          plus rien à ajouter. */}
                      {/* Le titre entier reste au survol, et la fiche est à un
                          clic — ce que la coupure retire est à portée. */}
                      <td>
                        <Link
                          href={`/contrats/${c.id}${qTri}`}
                          title={titreDe(c)}
                          className="block truncate font-medium text-strong hover:text-accent"
                        >
                          {titreDe(c)}
                        </Link>
                        {c.libelle && c.referenceMarche ? (
                          <span className="block truncate text-xs text-faint">
                            {c.referenceMarche}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="block truncate" title={c.fournisseur?.nom ?? undefined}>
                          {c.fournisseur?.nom ?? "—"}
                        </span>
                      </td>
                      {/* Même interligne que la période d'à côté — 16 px, posé
                          sur la CELLULE, seul endroit qui fixe la hauteur des
                          lignes. Sans lui, la police de 14 px de la table
                          imposait un plancher de 20 px, et deux colonnes au même
                          texte respiraient différemment. */}
                      <td className="text-xs leading-4">
                        {c.logiciels.length === 0 ? (
                          <span className="badge-muted">aucun</span>
                        ) : (
                          // La liste entière au survol : c'est la colonne où la
                          // coupure retire le plus, un marché pouvant couvrir
                          // plusieurs logiciels dont seul le premier se lira.
                          <span
                            className="block truncate text-muted"
                            title={c.logiciels.map((l) => l.logiciel.nom).join(" · ")}
                          >
                            {c.logiciels.map((l) => l.logiciel.nom).join(" · ")}
                          </span>
                        )}
                      </td>
                      {/* `leading-none` sur la CELLULE : c'est le bloc qui fixe
                          la hauteur des lignes, et la police de 14 px de la
                          table imposerait sinon un plancher de 20 px à chacune
                          des deux dates. */}
                      {/* Colonne centrée de bout en bout, en-tête compris : sa
                          largeur est fixe et ses dates ont toutes la même, si
                          bien qu'elles restent alignées entre elles — c'est ainsi
                          qu'on les compare — tout en tenant au milieu de la
                          colonne plutôt que collées à son bord gauche. */}
                      <td className="whitespace-nowrap text-center text-xs leading-none text-muted">
                        {periode ? (
                          <>
                            <span className="block">{periode.debut}</span>
                            <span className="mt-1 block">{periode.fin}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      {/* Alignée sur ses voisines — 12 px, gris — plutôt que sur
                          la taille de base de la table : c'est une donnée de
                          plus sur la ligne, pas son sujet. `tabular-nums` reste :
                          il donne à tous les chiffres la même chasse, et c'est
                          lui qui aligne les virgules d'une ligne à l'autre. */}
                      <td className="whitespace-nowrap text-right text-xs tabular-nums text-muted">
                        {montant ?? "—"}
                      </td>
                      <td className="pr-0 text-center">
                        {etat === "termine" ? (
                          <span className="badge-muted">Terminé</span>
                        ) : etat === "a_renouveler" ? (
                          <span className="badge-warn">À renouveler</span>
                        ) : (
                          <span className="badge-ok">En cours</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} params={params} />
    </>
  );
}
