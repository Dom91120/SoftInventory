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
            {/* Les trois premières à égalité, les horaires un peu moins large :
                c'est une phrase qui accepte de passer à la ligne, pas une adresse
                qu'il faut lire d'un trait. Sans largeur imposée, le tableau donne
                au support la moitié de la ligne et écrase le reste ;
                `table-fixed` fait tenir la répartition. */}
            <table className="data-table table-fixed">
              <thead>
                <tr>
                  <th className="w-[26.66%]">Éditeur</th>
                  <th className="w-[26.66%]">Contact commercial</th>
                  <th className="w-[26.66%]">Support</th>
                  <th className="w-[20%]">Horaires du support</th>
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
                          className="block break-all text-xs text-faint transition hover:text-accent hover:underline"
                        >
                          {e.siteWeb}
                        </a>
                      ) : null}
                    </td>
                    <td>
                      {/* Le nom entier ouvre le courrier, l'icône n'est plus une
                          cible de 12 pixels. À gauche, elle s'aligne sur celle du
                          téléphone dessous. Faute de nom, l'adresse tient le
                          libellé : chez bien des éditeurs, le commercial n'est
                          qu'une boîte partagée (« sales@… ») — un tiret suivi
                          d'une enveloppe à survoler cachait ce qu'on cherche.
                          D'où `break-words` et non `break-all` : la ligne porte
                          tantôt un nom, qui se coupe à l'espace et pas au milieu
                          d'« ORJEBIN », tantôt une adresse, seule longueur
                          insécable qu'il faille casser de force. */}
                      {e.commercialEmail ? (
                        <a
                          href={`mailto:${e.commercialEmail}`}
                          title={`Écrire à ${e.commercialEmail}`}
                          className="group flex items-start gap-1.5 break-words transition hover:text-accent"
                        >
                          <Mail className="mt-1 h-3 w-3 shrink-0 text-faint transition group-hover:text-accent" />
                          {e.commercialContact || e.commercialEmail}
                        </a>
                      ) : e.commercialContact ? (
                        <span>{e.commercialContact}</span>
                      ) : e.commercialTelephone ? null : (
                        "—"
                      )}
                      {/* Le numéro se range sous le nom, comme le site sous
                          l'éditeur : une personne et ses coordonnées tiennent
                          dans une seule colonne à balayer. */}
                      {e.commercialTelephone ? (
                        <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-faint">
                          <Phone className="h-3 w-3 shrink-0" />
                          {formatTel(e.commercialTelephone)}
                        </span>
                      ) : null}
                    </td>
                    {/* Les trois canaux de l'assistance en pile : le portail
                        d'abord, puis les deux adresses où l'on écrit avant celle
                        où l'on appelle. La fiche logiciel, elle, garde l'ordre
                        inverse — téléphone puis e-mail. */}
                    <td>
                      {/* `break-all` : une URL sans espace ne se coupe nulle part
                          et déborderait sur les horaires, la largeur étant fixe. */}
                      {e.supportUrl ? (
                        <a
                          href={hrefExterne(e.supportUrl)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="group flex items-start gap-1.5 break-all text-xs text-accent hover:underline"
                        >
                          <Globe className="mt-0.5 h-3 w-3 shrink-0 text-faint transition group-hover:text-accent" />
                          {hrefExterne(e.supportUrl)}
                        </a>
                      ) : null}
                      {e.supportEmail ? (
                        <a
                          href={`mailto:${e.supportEmail}`}
                          title={`Écrire à ${e.supportEmail}`}
                          className="mt-0.5 flex items-start gap-1.5 break-all text-xs text-faint transition hover:text-accent"
                        >
                          <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                          {e.supportEmail}
                        </a>
                      ) : null}
                      {e.supportTelephone ? (
                        <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-faint">
                          <Phone className="h-3 w-3 shrink-0" />
                          {formatTel(e.supportTelephone)}
                        </span>
                      ) : null}
                      {/* Le tiret ne vaut que pour une case entièrement vide : au
                          milieu d'une pile, il se lisait comme un canal manquant
                          alors qu'il ne disait que « pas de portail ». */}
                      {e.supportUrl || e.supportEmail || e.supportTelephone ? null : "—"}
                    </td>
                    {/* Les horaires sont une phrase — « du lundi au vendredi,
                        8h30-12h30 et 14h-17h » — pas une coordonnée : elle garde
                        sa colonne et le droit de passer à la ligne. */}
                    <td className="text-xs text-muted">{e.supportHoraires || "—"}</td>
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
