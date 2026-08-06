import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { listLogicielsPourRattachement } from "@/server/services/contrats";
import { listEditeurs } from "@/server/services/editeurs";
import { ContratForm } from "../contrat-form";

export const metadata: Metadata = { title: "Nouveau marché" };

export default async function NouveauContratPage() {
  await requireRole("admin");
  const [editeurs, logiciels] = await Promise.all([
    listEditeurs(),
    listLogicielsPourRattachement(),
  ]);
  return (
    <>
      <PageHeader
        title="Nouveau contrat / marché"
        subtitle="Les pièces s'ajoutent après création, depuis la fiche du marché"
      />
      <ContratForm
        editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
        logiciels={logiciels}
      />
    </>
  );
}
