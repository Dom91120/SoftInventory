import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { listServicesUtilisateurs } from "@/server/services/referentiels";
import { listServeurs } from "@/server/services/serveurs";
import { CertificatForm } from "../certificat-form";

export const metadata: Metadata = { title: "Nouveau certificat" };

export default async function NouveauCertificatPage() {
  await requireRole("admin");
  // Seules les AUTORITÉS de certification : c'est ce que le champ désigne.
  // Tant qu'aucune fiche n'est requalifiée, la liste est vide — qualifier
  // CERTINOMIS et consorts dans l'annuaire la remplit.
  const [editeurs, services, serveurs] = await Promise.all([
    listEditeurs({ categorie: "autorite_certification" }),
    listServicesUtilisateurs(),
    listServeurs(),
  ]);
  return (
    <>
      <PageHeader
        title="Nouveau certificat"
        subtitle="Les codes de l'autorité se saisissent ensuite, sur la fiche du certificat"
      />
      <CertificatForm
        editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
        services={services.map((s) => ({ id: s.id, nom: s.nom }))}
        serveurs={serveurs.map((s) => ({ id: s.id, nom: s.nom }))}
      />
    </>
  );
}
