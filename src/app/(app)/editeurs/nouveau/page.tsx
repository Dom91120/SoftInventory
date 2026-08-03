import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { EditeurForm } from "../editeur-form";

export const metadata: Metadata = { title: "Nouvel éditeur" };

export default async function NouvelEditeurPage() {
  await requireRole("admin");
  return (
    <>
      <PageHeader title="Nouvel éditeur" subtitle="Fiche fournisseur et canaux de support" />
      <EditeurForm />
    </>
  );
}
