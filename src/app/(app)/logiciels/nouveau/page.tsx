import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { seuilsRappel } from "@/server/config";
import { requireRole } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import {
  listCriticites,
  listStatutsLogiciels,
  listTechnologies,
} from "@/server/services/referentiels";
import { FicheForm } from "../fiche-form";

export const metadata: Metadata = { title: "Nouveau logiciel" };

export default async function NouveauLogicielPage() {
  await requireRole("admin");
  const [editeurs, technologies, criticites, statuts, seuils] = await Promise.all([
    listEditeurs(),
    listTechnologies(),
    listCriticites(),
    listStatutsLogiciels(),
    seuilsRappel(),
  ]);
  return (
    <>
      <PageHeader
        title="Nouveau logiciel"
        subtitle="Les liaisons (services, serveurs), contrats et documents s'ajoutent après création"
      />
      <FicheForm
        editeurs={editeurs.map((e) => ({ id: e.id, label: e.nom }))}
        technologies={technologies.map((t) => ({ id: t.id, label: t.label }))}
        criticites={criticites.map((c) => ({ id: c.id, label: c.label }))}
        statuts={statuts.map((s) => ({ cle: s.cle, label: s.label }))}
        rappelJoursAvant={seuils.contrat}
      />
    </>
  );
}
