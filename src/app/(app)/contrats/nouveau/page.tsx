import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { ContratForm } from "../contrat-form";

export const metadata: Metadata = { title: "Nouveau marché" };

export default async function NouveauContratPage() {
  await requireRole("admin");
  const editeurs = await listEditeurs();
  return (
    <>
      <PageHeader
        title="Nouveau contrat / marché"
        subtitle="Les logiciels couverts et les pièces s'ajoutent ensuite, sur la fiche du marché"
      />
      <ContratForm editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))} />
    </>
  );
}
