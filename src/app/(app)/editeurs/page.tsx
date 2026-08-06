import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarreListe } from "@/components/barre-liste";
import { Pagination, pageDepuisParams, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";

export const metadata: Metadata = { title: "Éditeurs" };

export default async function EditeursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const params = await searchParams;
  const tous = await listEditeurs({ q: params.q });
  const { page, pages, total, elements } = paginer(tous, pageDepuisParams(params));

  return (
    <>
      <PageHeader
        title="Éditeurs"
        subtitle={`${total} éditeur${total > 1 ? "s" : ""} dans l'annuaire`}
        actions={
          isAdmin ? (
            <Link href="/editeurs/nouveau" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouvel éditeur
            </Link>
          ) : undefined
        }
      />
      <BarreListe rechercheLabel="Rechercher un éditeur" exportHref="/editeurs/export" />
      {total === 0 ? (
        <EmptyState>
          {params.q
            ? "Aucun éditeur ne correspond à cette recherche."
            : `Aucun éditeur pour l'instant.${isAdmin ? " Créez le premier avec le bouton « Nouvel éditeur »." : ""}`}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Éditeur</th>
                  <th>Ville</th>
                  <th>Téléphone</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/editeurs/${e.id}`}
                        className="font-medium text-strong hover:text-accent"
                      >
                        {e.nom}
                      </Link>
                      {e.siteWeb ? (
                        <span className="block text-xs text-faint">{e.siteWeb}</span>
                      ) : null}
                    </td>
                    <td>{e.ville || "—"}</td>
                    <td>{e.telephone || "—"}</td>
                    <td>
                      {e.supportUrl || e.supportEmail || e.supportTelephone ? (
                        <span className="text-xs text-muted">
                          {[e.supportUrl && "portail", e.supportEmail, e.supportTelephone]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : (
                        <span className="badge-muted">non renseigné</span>
                      )}
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
