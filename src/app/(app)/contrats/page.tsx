import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC, formatEuros } from "@/lib/format";
import { dateCalendaire } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { requireUser } from "@/server/guards";
import { listContrats, nomDe } from "@/server/services/contrats";

export const metadata: Metadata = { title: "Contrats/Marchés" };

/** « du 01/01/2024 au 31/12/2028 », ou la seule borne connue. */
function periodeDe(debut: Date | null, fin: Date | null): string {
  const f = (d: Date) => DATE_FMT_FR_UTC.format(d);
  if (debut && fin) return `du ${f(debut)} au ${f(fin)}`;
  if (debut) return `à partir du ${f(debut)}`;
  if (fin) return `jusqu'au ${f(fin)}`;
  return "—";
}

/**
 * Tous les marchés de la collectivité, toutes fiches confondues — l'écran qui
 * répond à « quels engagements avons-nous ? », que l'onglet d'un logiciel ne
 * peut pas donner puisqu'il n'en montre qu'une part.
 */
export default async function ContratsPage() {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";
  const [contrats, { contrat: seuilJours }] = await Promise.all([listContrats(), seuilsRappel()]);

  // Même horizon que les rappels par e-mail et le tableau de bord : la pastille
  // « À renouveler » paraît quand le cron s'apprête à écrire.
  const aujourdhui = dateCalendaire(new Date());
  const limite = new Date(aujourdhui.getTime() + seuilJours * 86_400_000);

  return (
    <>
      <PageHeader
        title="Contrats/Marchés"
        subtitle="Les engagements de la collectivité, et les logiciels qu'ils couvrent"
        actions={
          isAdmin ? (
            <Link href="/contrats/nouveau" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouveau marché
            </Link>
          ) : undefined
        }
      />
      {contrats.length === 0 ? (
        <EmptyState>
          Aucun contrat ni marché pour l'instant.
          {isAdmin ? " Créez le premier avec le bouton « Nouveau marché »." : ""}
        </EmptyState>
      ) : (
        <div className="card px-5 py-4">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Fournisseur</th>
                  <th>Logiciels couverts</th>
                  <th>Période</th>
                  <th className="text-right">Mnt annuel</th>
                  <th className="text-center">État</th>
                </tr>
              </thead>
              <tbody>
                {contrats.map((c) => {
                  const termine = c.dateFin !== null && c.dateFin < aujourdhui;
                  const aRenouveler =
                    c.dateFin !== null && c.dateFin >= aujourdhui && c.dateFin <= limite;
                  const montant = formatEuros(
                    c.montantAnnuel === null ? null : String(c.montantAnnuel),
                  );
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/contrats/${c.id}`}
                          className="font-medium text-strong hover:text-accent"
                        >
                          {nomDe(c)}
                        </Link>
                        {c.libelle && c.referenceMarche ? (
                          <span className="block truncate text-xs text-faint" title={c.libelle}>
                            {c.libelle}
                          </span>
                        ) : null}
                      </td>
                      <td>{c.fournisseur?.nom ?? "—"}</td>
                      <td>
                        {c.logiciels.length === 0 ? (
                          <span className="badge-muted">aucun</span>
                        ) : (
                          <span className="text-xs text-muted">
                            {c.logiciels.map((l) => l.logiciel.nom).join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-muted">{periodeDe(c.dateDebut, c.dateFin)}</td>
                      <td className="text-right tabular-nums">{montant ?? "—"}</td>
                      <td className="text-center">
                        {termine ? (
                          <span className="badge-muted">Terminé</span>
                        ) : aRenouveler ? (
                          <span className="badge-warn">À renouveler</span>
                        ) : (
                          <span className="text-faint">—</span>
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
    </>
  );
}
