import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { LIBELLES } from "@/schemas/logiciel";
import { requireUser } from "@/server/guards";
import { getServeur } from "@/server/services/serveurs";
import { ServeurForm } from "../serveur-form";

export const metadata: Metadata = { title: "Serveur" };

export default async function ServeurPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();
  const serveur = await getServeur(id);
  if (!serveur) notFound();

  return (
    <>
      <PageHeader
        title={serveur.nom}
        subtitle={isAdmin ? "Fiche serveur" : "Fiche serveur (lecture seule)"}
      />
      <ServeurForm
        id={serveur.id}
        readOnly={!isAdmin}
        nbCertificats={serveur._count.certificats}
        values={{
          nom: serveur.nom,
          os: serveur.os,
          localisation: serveur.localisation,
          notes: serveur.notes,
        }}
        logiciels={
          // `key` sur l'élément-slot, comme sur les fiches éditeur et marché :
          // désérialisé du flux RSC au rendu serveur, React le tient pour le
          // membre d'une liste et peut réclamer une clé.
          <Card key="logiciels" title="Logiciels installés">
            {serveur.logiciels.length === 0 ? (
              <p className="text-sm text-faint">
                Aucun logiciel installé sur ce serveur. L'installation se déclare depuis l'onglet
                Liaisons de la fiche du logiciel.
              </p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {serveur.logiciels.map((ls) => (
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
          </Card>
        }
      />
    </>
  );
}
