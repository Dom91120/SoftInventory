import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { getCertificat } from "@/server/services/certificats";
import { listEditeurs } from "@/server/services/editeurs";
import { listServeurs, listServicesUtilisateurs } from "@/server/services/referentiels";
import { CertificatForm } from "../certificat-form";
import { CodesPanel } from "../codes-panel";

export const metadata: Metadata = { title: "Certificat" };

/** Les <input type="date"> attendent AAAA-MM-JJ ; la base rend des dates UTC. */
const jour = (d: Date | null) => (d === null ? "" : d.toISOString().slice(0, 10));
const texte = (v: number | string | null) => (v === null ? "" : String(v));

export default async function CertificatPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [certificat, editeurs, services, serveurs] = await Promise.all([
    getCertificat(id),
    listEditeurs(),
    listServicesUtilisateurs(),
    listServeurs(),
  ]);
  if (!certificat) notFound();

  return (
    <>
      <PageHeader
        title={certificat.titulaire}
        subtitle={
          [certificat.fonction, certificat.fournisseur?.nom].filter(Boolean).join(" · ") ||
          "Certificat électronique"
        }
      />
      <CertificatForm
        id={id}
        readOnly={!isAdmin}
        editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
        services={services.map((s) => ({ id: s.id, nom: s.nom }))}
        serveurs={serveurs.map((s) => ({ id: s.id, nom: s.nom }))}
        values={{
          titulaire: certificat.titulaire,
          fonction: certificat.fonction,
          email: certificat.email,
          fournisseurId: texte(certificat.fournisseurId),
          serviceId: texte(certificat.serviceId),
          serveurId: texte(certificat.serveurId),
          usage: certificat.usage ?? "",
          support: certificat.support ?? "",
          niveau: certificat.niveau,
          numeroSerie: certificat.numeroSerie,
          dateDebut: jour(certificat.dateDebut),
          dateFin: jour(certificat.dateFin),
          dureeAnnees: texte(certificat.dureeAnnees),
          montantTtc: certificat.montantTtc === null ? "" : String(certificat.montantTtc),
          imputation: certificat.imputation,
          bonCommandeLe: jour(certificat.bonCommandeLe),
          bonCommandeNote: certificat.bonCommandeNote,
          statut: certificat.statut,
          notes: certificat.notes,
        }}
      >
        {/* La carte des codes n'est pas rendue au lecteur — et l'action qu'elle
            appelle exige de toute façon le rôle admin. */}
        {isAdmin ? <CodesPanel id={id} /> : null}
      </CertificatForm>
    </>
  );
}
