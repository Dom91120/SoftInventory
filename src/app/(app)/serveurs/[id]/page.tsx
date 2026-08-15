import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { Card, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { LIBELLES } from "@/schemas/logiciel";
import { requireUser } from "@/server/guards";
import { getServeur, voisinsServeur } from "@/server/services/serveurs";
import { ServeurForm } from "../serveur-form";

export const metadata: Metadata = { title: "Serveur" };

export default async function ServeurPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();
  const [serveur, voisins] = await Promise.all([getServeur(id), voisinsServeur(id)]);
  if (!serveur) notFound();

  return (
    <>
      {/* L'en-tête est encadré des flèches de navigation : on parcourt le parc
          sans repasser par la liste, DANS SON ORDRE — alphabétique, celui des
          deux vues de l'écran Serveurs. Pas d'onglet à conserver ici : la fiche
          serveur tient dans un écran. */}
      <div className="mb-4 flex items-start gap-2">
        <FlecheVoisin
          voisin={voisins.precedent}
          sens="precedent"
          hrefBase="/serveurs"
          entite="Serveur"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            className=""
            title={serveur.nom}
            subtitle={isAdmin ? "Fiche serveur" : "Fiche serveur (lecture seule)"}
          />
        </div>
        <FlecheVoisin
          voisin={voisins.suivant}
          sens="suivant"
          hrefBase="/serveurs"
          entite="Serveur"
        />
      </div>
      <ServeurForm
        id={serveur.id}
        readOnly={!isAdmin}
        nbCertificats={serveur._count.certificats}
        values={{
          nom: serveur.nom,
          virtuel: serveur.virtuel,
          // null (non renseigné) → "" : c'est l'option vide de la liste.
          typeOs: serveur.typeOs ?? "",
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
