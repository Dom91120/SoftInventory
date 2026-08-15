import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { listLogicielsNoms } from "@/server/services/logiciels";
import {
  listCriticites,
  listModesHebergement,
  listStatutsLogiciels,
  listTechnologies,
} from "@/server/services/referentiels";
import { CreationServeur } from "./creation-serveur";

export const metadata: Metadata = { title: "Nouveau serveur" };

export default async function NouveauServeurPage() {
  await requireRole("admin");
  const [logiciels, editeurs, technologies, criticites, statuts, hebergements] = await Promise.all([
    listLogicielsNoms(),
    // Les cinq référentiels de la fiche logiciel : ils ne servent qu'à la modale
    // du « + », qui crée une application absente de l'inventaire.
    listEditeurs(),
    listTechnologies(),
    listCriticites(),
    listStatutsLogiciels(),
    listModesHebergement(),
  ]);
  return (
    <>
      <PageHeader
        title="Nouveau serveur"
        subtitle="Les logiciels installés se déclarent ici même, et se posent à la création"
      />
      <CreationServeur
        logiciels={logiciels.map((l) => ({ id: l.id, label: l.nom }))}
        referentiels={{
          editeurs: editeurs.map((e) => ({ id: e.id, label: e.nom })),
          technologies: technologies.map((t) => ({ id: t.id, label: t.label })),
          criticites: criticites.map((c) => ({ id: c.id, label: c.label })),
          statuts: statuts.map((s) => ({ cle: s.cle, label: s.label })),
          hebergements: hebergements.map((h) => ({ cle: h.cle, label: h.label })),
        }}
      />
    </>
  );
}
