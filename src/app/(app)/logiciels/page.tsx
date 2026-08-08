import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagination, pageDepuisParams, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { listLogiciels } from "@/server/services/logiciels";
import {
  listCriticites,
  listModesHebergement,
  listServicesUtilisateurs,
  listStatutsLogiciels,
  listTechnologies,
} from "@/server/services/referentiels";
import { FiltresBar } from "./filtres-bar";
import { CriticiteBadge, filtresDepuisParams, HebergementBadge, StatutBadge } from "./shared";

export const metadata: Metadata = { title: "Logiciels" };

export default async function LogicielsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const params = await searchParams;
  const filtres = filtresDepuisParams(params);

  const [tous, editeurs, services, criticites, technologies, statuts, hebergements] =
    await Promise.all([
      listLogiciels(filtres),
      listEditeurs(),
      listServicesUtilisateurs(),
      listCriticites(),
      listTechnologies(),
      listStatutsLogiciels(),
      listModesHebergement(),
    ]);

  const { page, pages, total, elements: logiciels } = paginer(tous, pageDepuisParams(params));

  const opt = (rows: Array<{ id: number; nom?: string; label?: string }>) =>
    rows.map((r) => ({ id: r.id, label: r.nom ?? r.label ?? "" }));

  return (
    <>
      <PageHeader
        title="Logiciels"
        subtitle={`${total} logiciel${total > 1 ? "s" : ""} dans l'inventaire`}
        actions={
          isAdmin ? (
            <Link href="/logiciels/nouveau" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouveau logiciel
            </Link>
          ) : undefined
        }
      />
      <FiltresBar
        editeurs={opt(editeurs)}
        services={opt(services)}
        criticites={opt(criticites)}
        technologies={opt(technologies)}
        statuts={statuts.map((s) => ({ cle: s.cle, label: s.label }))}
        hebergements={hebergements.map((h) => ({ cle: h.cle, label: h.label }))}
      />
      {total === 0 ? (
        <EmptyState>
          Aucun logiciel ne correspond.
          {isAdmin ? " Ajoutez-en un avec « Nouveau logiciel », ou élargissez les filtres." : ""}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            {/* `table-fixed` : en disposition automatique, une cellule que l'on
                empêche de se couper (`truncate`) élargit sa colonne au lieu de
                se tronquer, et les pourcentages ci-dessous n'étaient plus que
                des vœux. En disposition fixe, les largeurs déclarées font loi et
                la troncature se déclenche. */}
            <table className="data-table table-fixed">
              {/* Les largeurs vivent dans le `colgroup`, leur place : elles
                  décrivent la colonne, pas la cellule d'en-tête. Chacune déclare
                  sa part et la somme fait 100 — en disposition fixe, une colonne
                  qui se tait prend ce qui reste, à parts égales avec les autres
                  muettes, et « On premise » se repliait alors sur deux lignes.

                  L'HÉBERGEMENT passe de 14 à 17 %, les trois points venant des
                  services : son en-tête, plus long que ses valeurs, se tronquait
                  en « Hébergemen ». Les services les rendent sans dommage — leurs
                  noms sont trop longs pour tenir sur une ligne de toute façon,
                  une part de plus ou de moins ne change que l'endroit où ils se
                  replient. */}
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Logiciel</th>
                  <th>Éditeur</th>
                  <th className="text-center">Hébergement</th>
                  <th>Services</th>
                  <th className="text-center">Criticité</th>
                  <th className="text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {logiciels.map((l) => (
                  // Hauteur fixée : d'une ligne à l'autre, le nombre de services
                  // et le repli des noms faisaient varier la rangée du simple au
                  // double, et l'œil perdait le pas en descendant la liste. Les
                  // cellules sont déjà centrées verticalement (`align-middle` de
                  // .data-table), les contenus courts se posent donc au milieu
                  // plutôt qu'en haut.
                  <tr key={l.id} className="h-12">
                    {/* Le nom entier reste au survol, et la fiche est à un clic. */}
                    <td>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={`/logiciels/${l.id}`}
                          title={l.nom}
                          className="truncate font-medium text-strong hover:text-accent"
                        >
                          {l.nom}
                        </Link>
                        {l.url ? (
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            title={`Ouvrir ${l.url}`}
                            className="shrink-0 text-faint hover:text-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </span>
                      {l.technologie ? (
                        <span className="block truncate text-xs text-faint">
                          {l.technologie.label}
                        </span>
                      ) : null}
                    </td>
                    {/* Fait maison : pas d'éditeur, mais la colonne doit le
                        dire plutôt que d'afficher un tiret trompeur. */}
                    <td>
                      <span
                        className="block truncate"
                        title={
                          l.developpementInterne
                            ? "Développement interne"
                            : (l.editeur?.nom ?? undefined)
                        }
                      >
                        {l.developpementInterne ? (
                          <span className="text-muted">Développement interne</span>
                        ) : (
                          (l.editeur?.nom ?? "—")
                        )}
                      </span>
                    </td>
                    <td className="text-center [&>span]:px-2 [&>span]:py-0 [&>span]:text-[11px]">
                      <HebergementBadge hebergement={l.hebergement} hebergements={hebergements} />
                    </td>
                    {/* `leading-none` sur la CELLULE, pas sur le span : la
                        hauteur d'une ligne est celle du bloc qui la contient, et
                        la cellule impose un plancher de 20 px (sa police de
                        14 px). Posée sur le span, la consigne était ignorée.
                        C'est la seule colonne qui se replie souvent sur deux ou
                        trois lignes, et cet interligne y creusait la rangée. */}
                    <td className="text-xs leading-none">
                      <span className="text-muted">
                        {l.services.map((s) => s.service.nom).join(" · ") || "—"}
                      </span>
                    </td>
                    {/* Un tiret, pas la pastille « Non évaluée » : la plupart
                        des fiches n'ont pas de criticité, et la colonne
                        alignait des dizaines de pastilles grises qui ne
                        disaient rien et couvraient les quelques-unes qui
                        disent quelque chose. La fiche du logiciel, elle, garde
                        le libellé — le badge y est seul et doit se nommer. */}
                    {/* Pastilles resserrées : sur une LISTE, elles se comptent
                        par dizaines et deux colonnes entières de pilules pleine
                        taille pèsent plus que ce qu'elles disent. Les fiches
                        gardent le gabarit normal, où le badge est seul. */}
                    <td className="text-center [&>span]:px-2 [&>span]:py-0 [&>span]:text-[11px]">
                      {l.criticite ? (
                        <CriticiteBadge criticite={l.criticite} />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="text-center [&>span]:px-2 [&>span]:py-0 [&>span]:text-[11px]">
                      <StatutBadge statut={l.statut} statuts={statuts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} params={params} />
    </>
  );
}
