import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { LIBELLES } from "@/schemas/logiciel";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";

export const metadata: Metadata = { title: "Serveurs" };

/**
 * Vue de LECTURE : quels logiciels tournent où. L'édition du référentiel des
 * serveurs se fait en Administration › Référentiels ; l'association
 * logiciel ↔ serveur sur la fiche du logiciel (onglet Liaisons).
 */
export default async function ServeursPage() {
  await requireUser();
  const serveurs = await prisma.serveur.findMany({
    orderBy: { nom: "asc" },
    include: {
      logiciels: {
        include: { logiciel: { select: { id: true, nom: true } } },
        orderBy: { logiciel: { nom: "asc" } },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Serveurs"
        subtitle="Où les applications sont installées (association depuis la fiche de chaque logiciel)"
      />
      {serveurs.length === 0 ? (
        <EmptyState>
          Aucun serveur dans le référentiel — un admin peut en ajouter depuis Administration ›
          Référentiels › Serveurs.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {serveurs.map((s) => (
            <section key={s.id} className="card p-5">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-strong">{s.nom}</h2>
                <span className="text-xs text-faint">
                  {[s.os, s.localisation].filter(Boolean).join(" · ")}
                </span>
              </div>
              {s.logiciels.length === 0 ? (
                <p className="text-sm text-faint">Aucun logiciel associé.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {s.logiciels.map((ls) => (
                    <li
                      key={`${ls.logicielId}-${ls.environnement}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <Link
                        href={`/logiciels/${ls.logiciel.id}`}
                        className="font-medium text-strong hover:text-accent"
                      >
                        {ls.logiciel.nom}
                      </Link>
                      <span
                        className={ls.environnement === "production" ? "badge-ok" : "badge-muted"}
                      >
                        {LIBELLES.environnement[ls.environnement]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
