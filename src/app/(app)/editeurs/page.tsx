import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";

export const metadata: Metadata = { title: "Éditeurs" };

export default async function EditeursPage() {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const editeurs = await listEditeurs();

  return (
    <>
      <PageHeader
        title="Éditeurs"
        subtitle="Les fournisseurs de logiciels et leurs canaux de support"
        actions={
          isAdmin ? (
            <Link href="/editeurs/nouveau" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouvel éditeur
            </Link>
          ) : undefined
        }
      />
      {editeurs.length === 0 ? (
        <EmptyState>
          Aucun éditeur pour l'instant.
          {isAdmin ? " Créez le premier avec le bouton « Nouvel éditeur »." : ""}
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
                {editeurs.map((e) => (
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
    </>
  );
}
