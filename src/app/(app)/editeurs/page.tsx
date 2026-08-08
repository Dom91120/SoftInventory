import { Globe, Mail, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarreListe } from "@/components/barre-liste";
import { Pagination, pageDepuisParams, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { formatTel } from "@/lib/format";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";

export const metadata: Metadata = { title: "Éditeurs" };

/**
 * Une adresse enregistrée sans protocole — « client.editeur.fr/csm » — serait
 * comprise comme un chemin relatif et mènerait à une page de l'application. Le
 * schéma l'interdit désormais, les fiches importées avant lui, non. Sert aussi
 * à l'AFFICHAGE du portail, pour que le « https:// » y paraisse toujours.
 */
function hrefExterne(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

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
                  <th>Contact commercial</th>
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
                      {/* Le site s'ouvre dans un onglet à part : la liste reste
                          où elle en était, recherche et page comprises. */}
                      {e.siteWeb ? (
                        <a
                          href={hrefExterne(e.siteWeb)}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={`Ouvrir ${e.siteWeb}`}
                          className="block text-xs text-faint transition hover:text-accent hover:underline"
                        >
                          {e.siteWeb}
                        </a>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">
                      {/* Le nom entier ouvre le courrier, l'icône n'est plus une
                          cible de 12 pixels. Elle paraît même sans nom : l'adresse
                          commerciale est parfois la seule chose connue
                          (« sales@… »), et elle n'a plus de colonne où se montrer.
                          À gauche, elle s'aligne sur celle du téléphone dessous. */}
                      {e.commercialEmail ? (
                        <a
                          href={`mailto:${e.commercialEmail}`}
                          title={`Écrire à ${e.commercialEmail}`}
                          className="group inline-flex items-center gap-1.5 transition hover:text-accent"
                        >
                          <Mail className="h-3 w-3 shrink-0 text-faint transition group-hover:text-accent" />
                          {e.commercialContact || "—"}
                        </a>
                      ) : (
                        <span>{e.commercialContact || "—"}</span>
                      )}
                      {/* Le numéro se range sous le nom, comme le site sous
                          l'éditeur : une personne et ses coordonnées tiennent
                          dans une seule colonne à balayer. */}
                      {e.commercialTelephone ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                          <Phone className="h-3 w-3 shrink-0" />
                          {formatTel(e.commercialTelephone)}
                        </span>
                      ) : null}
                    </td>
                    {/* Les trois canaux de l'assistance en pile : le portail
                        d'abord, puis les deux adresses où l'on écrit avant celle
                        où l'on appelle. La fiche logiciel, elle, garde l'ordre
                        inverse — téléphone puis e-mail. */}
                    <td className="whitespace-nowrap">
                      {e.supportUrl ? (
                        <a
                          href={hrefExterne(e.supportUrl)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="group flex items-center gap-1.5 text-xs text-accent hover:underline"
                        >
                          <Globe className="h-3 w-3 shrink-0 text-faint transition group-hover:text-accent" />
                          {hrefExterne(e.supportUrl)}
                        </a>
                      ) : (
                        "—"
                      )}
                      {e.supportEmail ? (
                        <a
                          href={`mailto:${e.supportEmail}`}
                          title={`Écrire à ${e.supportEmail}`}
                          className="mt-0.5 flex items-center gap-1.5 text-xs text-faint transition hover:text-accent"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          {e.supportEmail}
                        </a>
                      ) : null}
                      {e.supportTelephone ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                          <Phone className="h-3 w-3 shrink-0" />
                          {formatTel(e.supportTelephone)}
                        </span>
                      ) : null}
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
