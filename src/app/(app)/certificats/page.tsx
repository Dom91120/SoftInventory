import { CalendarClock, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarreListe } from "@/components/barre-liste";
import { Pagination, pageDepuisParams, paginer } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC } from "@/lib/format";
import {
  LIBELLES_CERTIFICAT,
  nomTitulaire,
  STATUTS_CERTIFICAT,
  USAGES_CERTIFICAT,
} from "@/schemas/certificat";
import { requireUser } from "@/server/guards";
import { listAutoritesCertification, listCertificats } from "@/server/services/certificats";
import { listServicesUtilisateurs } from "@/server/services/referentiels";
import { filtresDepuisParams, joursAvantExpiration, pastilleValidite } from "./shared";

export const metadata: Metadata = { title: "Certificats" };

export default async function CertificatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const params = await searchParams;

  const [tous, autorites, services] = await Promise.all([
    listCertificats(filtresDepuisParams(params)),
    listAutoritesCertification(),
    listServicesUtilisateurs(),
  ]);
  const { page, pages, total, elements } = paginer(tous, pageDepuisParams(params));
  const aujourdhui = new Date();

  return (
    <>
      <PageHeader
        title="Certificats"
        subtitle={`${total} certificat${total > 1 ? "s" : ""} électronique${total > 1 ? "s" : ""}`}
        actions={
          isAdmin ? (
            <Link href="/certificats/nouveau" className="btn-primary" title="Nouveau certificat">
              <Plus className="h-4 w-4" />
              Certificat
            </Link>
          ) : undefined
        }
      />
      {/* Quatre filtres : d'où vient le certificat, pour qui, ce qu'il permet,
          où il en est. La recherche, elle, porte sur le titulaire et le numéro
          de série — les deux façons de retrouver un certificat précis. */}
      <BarreListe
        rechercheLabel="Rechercher un titulaire ou un numéro de série"
        exportHref="/certificats/export"
        selects={[
          {
            key: "service",
            label: "Service",
            options: services.map((s) => ({ value: String(s.id), label: s.nom })),
          },
          {
            key: "fournisseur",
            label: "Autorité",
            options: autorites.map((a) => ({ value: String(a.id), label: a.nom })),
          },
          {
            key: "usage",
            label: "Usage",
            options: USAGES_CERTIFICAT.map((u) => ({
              value: u,
              label: LIBELLES_CERTIFICAT.usage[u],
            })),
          },
          {
            key: "statut",
            label: "Statut",
            options: STATUTS_CERTIFICAT.map((s) => ({
              value: s,
              label: LIBELLES_CERTIFICAT.statut[s],
            })),
          },
        ]}
      />
      {total === 0 ? (
        <EmptyState>
          {Object.keys(params).length > 0
            ? "Aucun certificat ne correspond."
            : `Aucun certificat pour l'instant.${isAdmin ? " Créez le premier avec le bouton « + Certificat »." : ""}`}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            <table className="data-table table-fixed">
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Titulaire</th>
                  <th>Service</th>
                  <th>Autorité</th>
                  <th>Validité</th>
                  <th>Type / Modèle</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((c) => {
                  const jours = joursAvantExpiration(c.dateFin, aujourdhui);
                  const pastille = pastilleValidite(c, jours);
                  return (
                    <tr key={c.id} className="h-12">
                      <td>
                        {/* Le titulaire mène à sa fiche ; sa fonction se range
                            dessous, comme la technologie sous le logiciel. */}
                        <Link
                          href={`/certificats/${c.id}`}
                          title={nomTitulaire(c)}
                          className="block truncate font-medium text-strong hover:text-accent"
                        >
                          {nomTitulaire(c)}
                        </Link>
                        <span className="block truncate text-xs text-faint">
                          {[c.fonction, c.usage ? LIBELLES_CERTIFICAT.usage[c.usage] : ""]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="block truncate text-muted">{c.service?.nom ?? "—"}</span>
                      </td>
                      <td>
                        <span className="block truncate text-muted">
                          {c.fournisseur?.nom ?? "—"}
                        </span>
                      </td>
                      <td>
                        {/* La période en clair, et sous elle le compte à rebours
                            coloré : l'une répond « jusqu'à quand ? », l'autre
                            « est-ce urgent ? ». */}
                        <span className="block whitespace-nowrap text-xs text-muted tabular-nums">
                          {c.dateDebut ? DATE_FMT_FR_UTC.format(c.dateDebut) : "—"}
                          {" → "}
                          {c.dateFin ? DATE_FMT_FR_UTC.format(c.dateFin) : "—"}
                        </span>
                        <span className={`${pastille.classe} mt-0.5`}>
                          <CalendarClock className="h-3.5 w-3.5" />
                          {pastille.texte}
                        </span>
                      </td>
                      <td>
                        <span className="block truncate text-muted" title={c.niveau || undefined}>
                          {c.niveau || "—"}
                        </span>
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
