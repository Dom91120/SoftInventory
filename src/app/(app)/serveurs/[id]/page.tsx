import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ID_COMMANDES_ONGLET } from "@/components/commandes-onglet";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { ModeFicheProvider } from "@/components/mode-fiche";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { listLogicielsNoms } from "@/server/services/logiciels";
import {
  listCriticites,
  listModesHebergement,
  listStatutsLogiciels,
  listTechnologies,
} from "@/server/services/referentiels";
import { getServeur, voisinsServeur } from "@/server/services/serveurs";
import { LogicielsPanel } from "../logiciels-panel";
import { ServeurForm } from "../serveur-form";

export const metadata: Metadata = { title: "Serveur" };

export default async function ServeurPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();
  const [serveur, voisins, logiciels, editeurs, technologies, criticites, statuts, hebergements] =
    await Promise.all([
      getServeur(id),
      voisinsServeur(id),
      // Tout l'inventaire : c'est parmi lui qu'on désigne ce qui tourne ici.
      listLogicielsNoms(),
      // Les cinq référentiels de la fiche logiciel : ils ne servent qu'à la
      // modale du « + », qui crée une application absente de l'inventaire sans
      // quitter cette fiche.
      listEditeurs(),
      listTechnologies(),
      listCriticites(),
      listStatutsLogiciels(),
      listModesHebergement(),
    ]);
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

      {/* Le MÊME verrou que les cinq autres fiches : elles s'ouvrent en lecture,
          et leur crayon vit au bout de la barre d'onglets. Celle-ci n'a pas
          d'onglets — elle tient dans un écran —, mais elle garde la BARRE,
          réduite à son filet et à l'emplacement où le crayon vient se poser par
          portail. Le geste et sa place ne changent donc pas d'une fiche à
          l'autre, et le parc ne se modifie plus d'un clic distrait dans un
          champ. */}
      <ModeFicheProvider readOnly={!isAdmin} objet="cette fiche">
        <div className="mb-3 flex items-end justify-end border-b border-line pb-px">
          <div id={ID_COMMANDES_ONGLET} className="flex shrink-0 items-center gap-1 pb-[3px]" />
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
            <LogicielsPanel
              key="logiciels"
              serveurId={serveur.id}
              readOnly={!isAdmin}
              installations={serveur.logiciels.map((ls) => ({
                logicielId: ls.logiciel.id,
                nom: ls.logiciel.nom,
              }))}
              logiciels={logiciels.map((l) => ({ id: l.id, label: l.nom }))}
              referentiels={{
                editeurs: editeurs.map((e) => ({ id: e.id, label: e.nom })),
                technologies: technologies.map((t) => ({ id: t.id, label: t.label })),
                criticites: criticites.map((c) => ({ id: c.id, label: c.label })),
                statuts: statuts.map((s) => ({ cle: s.cle, label: s.label })),
                hebergements: hebergements.map((h) => ({ cle: h.cle, label: h.label })),
              }}
            />
          }
        />
      </ModeFicheProvider>
    </>
  );
}
