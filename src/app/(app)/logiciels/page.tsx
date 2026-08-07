import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagination, pageDepuisParams, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { LIBELLES } from "@/schemas/logiciel";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { listLogiciels } from "@/server/services/logiciels";
import {
  listCriticites,
  listServicesUtilisateurs,
  listStatutsLogiciels,
  listTechnologies,
} from "@/server/services/referentiels";
import { FiltresBar } from "./filtres-bar";
import { CriticiteBadge, filtresDepuisParams, StatutBadge } from "./shared";

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

  const [tous, editeurs, services, criticites, technologies, statuts] = await Promise.all([
    listLogiciels(filtres),
    listEditeurs(),
    listServicesUtilisateurs(),
    listCriticites(),
    listTechnologies(),
    listStatutsLogiciels(),
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
      />
      {total === 0 ? (
        <EmptyState>
          Aucun logiciel ne correspond.
          {isAdmin ? " Ajoutez-en un avec « Nouveau logiciel », ou élargissez les filtres." : ""}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[24%]">Logiciel</th>
                  {/* L'éditeur cesse d'être serré au profit du nom : « Avanti
                      Technologies (Agorabox) » se repliait sur trois lignes et
                      étirait toute la rangée. */}
                  <th className="w-[20%]">Éditeur</th>
                  <th>Hébergement</th>
                  {/* La largeur libérée par « Utilisation » revient ici : les
                      services tenaient sur 80 px, ce qui repliait deux noms en
                      autant de lignes. */}
                  <th className="w-[22%]">Services</th>
                  <th className="text-center">Criticité</th>
                  <th className="text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {logiciels.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <Link
                          href={`/logiciels/${l.id}`}
                          className="font-medium text-strong hover:text-accent"
                        >
                          {l.nom}
                        </Link>
                        {l.url ? (
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            title={`Ouvrir ${l.url}`}
                            className="text-faint hover:text-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </span>
                      {l.technologie ? (
                        <span className="block text-xs text-faint">{l.technologie.label}</span>
                      ) : null}
                    </td>
                    {/* Fait maison : pas d'éditeur, mais la colonne doit le
                        dire plutôt que d'afficher un tiret trompeur. */}
                    <td>
                      {l.developpementInterne ? (
                        <span className="text-muted">Développement interne</span>
                      ) : (
                        (l.editeur?.nom ?? "—")
                      )}
                    </td>
                    <td>{LIBELLES.hebergement[l.hebergement]}</td>
                    <td className="max-w-64">
                      <span className="text-xs text-muted">
                        {l.services.map((s) => s.service.nom).join(" · ") || "—"}
                      </span>
                    </td>
                    {/* Un tiret, pas la pastille « Non évaluée » : la plupart
                        des fiches n'ont pas de criticité, et la colonne
                        alignait des dizaines de pastilles grises qui ne
                        disaient rien et couvraient les quelques-unes qui
                        disent quelque chose. La fiche du logiciel, elle, garde
                        le libellé — le badge y est seul et doit se nommer. */}
                    <td className="text-center">
                      {l.criticite ? (
                        <CriticiteBadge criticite={l.criticite} />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="text-center">
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
