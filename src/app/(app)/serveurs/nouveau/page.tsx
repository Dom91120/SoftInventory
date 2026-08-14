import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { ServeurForm } from "../serveur-form";

export const metadata: Metadata = { title: "Nouveau serveur" };

export default async function NouveauServeurPage() {
  await requireRole("admin");
  return (
    <>
      <PageHeader
        title="Nouveau serveur"
        subtitle="Les logiciels s'y installent ensuite, depuis l'onglet Liaisons de leur fiche"
      />
      <ServeurForm />
    </>
  );
}
