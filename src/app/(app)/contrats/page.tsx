import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarreListe } from "@/components/barre-liste";
import { Pagination, pageDepuisParams, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC, formatEuros } from "@/lib/format";
import { dateCalendaire } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { requireUser } from "@/server/guards";
import { etatMarche, listContrats, titreDe } from "@/server/services/contrats";
import { listEditeurs } from "@/server/services/editeurs";
import { filtresContratsDepuisParams } from "./shared";

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
  const [tous, fournisseurs, { contrat: seuilJours }] = await Promise.all([
    listContrats(filtresContratsDepuisParams(params)),
    listEditeurs(),
    seuilsRappel(),
  ]);
  const { page, pages, total, elements: contrats } = paginer(tous, pageDepuisParams(params));

  // Même horizon que les rappels par e-mail et le tableau de bord : la pastille
  // « À renouveler » paraît quand le cron s'apprête à écrire.
  const aujourdhui = dateCalendaire(new Date());
  const limite = new Date(aujourdhui.getTime() + seuilJours * 86_400_000);

  return (
    <>
      <PageHeader
        title="Contrats/Marchés"
        subtitle={`${total} contrat${total > 1 ? "s" : ""} ou marché${total > 1 ? "s" : ""}`}
        actions={
          isAdmin ? (
            <Link href="/contrats/nouveau" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouveau marché
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
            : `Aucun contrat ni marché pour l'instant.${isAdmin ? " Créez le premier avec le bouton « Nouveau marché »." : ""}`}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            <table className="data-table">
              {/* Deux colonnes déclarées, les autres se partagent le reste.

                  Le FOURNISSEUR reçoit la place rendue par la période, que rien
                  ne lui réclamait jusqu'ici : « Ressources Consultants Finances »
                  se repliait sur trois lignes et étirait toute la rangée.

                  Le MONTANT tient sur 6.25rem : « 999 999,99 € » mesure 88 px
                  dans la fonte de la cellule (12 px, chiffres à chasse fixe), et
                  la cellule pousse 12 px à sa droite. En dessous, le plus gros
                  montant possible se couperait en deux lignes. */}
              <colgroup>
                <col />
                <col style={{ width: "25%" }} />
                <col />
                <col />
                <col style={{ width: "6.25rem" }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Marché</th>
                  <th>Fournisseur</th>
                  <th>Logiciels couverts</th>
                  <th>Période</th>
                  <th className="text-right">Mnt annuel</th>
                  <th className="text-center">État</th>
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
                    <tr key={c.id}>
                      {/* Le libellé d'abord — il dit de quoi il s'agit —, la
                          référence en dessous : même hiérarchie que l'en-tête
                          de la fiche. `titreDe` retombe sur la référence quand
                          le libellé manque, auquel cas la seconde ligne n'a
                          plus rien à ajouter. */}
                      <td>
                        <Link
                          href={`/contrats/${c.id}`}
                          className="font-medium text-strong hover:text-accent"
                        >
                          {titreDe(c)}
                        </Link>
                        {c.libelle && c.referenceMarche ? (
                          <span className="block truncate text-xs text-faint">
                            {c.referenceMarche}
                          </span>
                        ) : null}
                      </td>
                      <td>{c.fournisseur?.nom ?? "—"}</td>
                      {/* Même interligne que la période d'à côté — 16 px, posé
                          sur la CELLULE, seul endroit qui fixe la hauteur des
                          lignes. Sans lui, la police de 14 px de la table
                          imposait un plancher de 20 px, et deux colonnes au même
                          texte respiraient différemment. */}
                      <td className="text-xs leading-4">
                        {c.logiciels.length === 0 ? (
                          <span className="badge-muted">aucun</span>
                        ) : (
                          <span className="text-muted">
                            {c.logiciels.map((l) => l.logiciel.nom).join(" · ")}
                          </span>
                        )}
                      </td>
                      {/* `leading-none` sur la CELLULE : c'est le bloc qui fixe
                          la hauteur des lignes, et la police de 14 px de la
                          table imposerait sinon un plancher de 20 px à chacune
                          des deux dates. */}
                      <td className="whitespace-nowrap text-xs leading-none text-muted">
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
                      <td className="text-center">
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
