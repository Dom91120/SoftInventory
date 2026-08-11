import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentsPanel } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { getCertificat, voisinsCertificat } from "@/server/services/certificats";
import { listEditeurs } from "@/server/services/editeurs";
import {
  listCategoriesDocuments,
  listServeurs,
  listServicesUtilisateurs,
} from "@/server/services/referentiels";
import { CertificatForm } from "../certificat-form";
import { CodesPanel } from "../codes-panel";

export const metadata: Metadata = { title: "Certificat" };

/** Horodatage d'un dépôt : une heure locale, pas une date de calendrier. */
const FMT_DEPOT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeZone: "Europe/Paris",
});

/** Les <input type="date"> attendent AAAA-MM-JJ ; la base rend des dates UTC. */
const jour = (d: Date | null) => (d === null ? "" : d.toISOString().slice(0, 10));
const texte = (v: number | string | null) => (v === null ? "" : String(v));

export default async function CertificatPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [certificat, editeurs, services, serveurs, categories, voisins] = await Promise.all([
    getCertificat(id),
    listEditeurs(),
    listServicesUtilisateurs(),
    listServeurs(),
    listCategoriesDocuments(),
    voisinsCertificat(id),
  ]);
  if (!certificat) notFound();

  return (
    <>
      {/* L'en-tête est encadré des flèches de navigation : on parcourt ainsi
          les certificats sans repasser par la liste, DANS SON ORDRE — du plus
          pressant au plus lointain, puisque c'est par échéance qu'elle est
          rangée. La fiche logiciel, elle, se parcourt alphabétiquement : chaque
          liste impose son ordre à ses flèches. */}
      <div className="mb-4 flex items-start gap-2">
        <FlecheVoisin
          voisin={voisins.precedent}
          sens="precedent"
          hrefBase="/certificats"
          entite="Certificat"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            className=""
            title={certificat.titulaire}
            subtitle={
              [certificat.fonction, certificat.fournisseur?.nom].filter(Boolean).join(" · ") ||
              "Certificat électronique"
            }
          />
        </div>
        <FlecheVoisin
          voisin={voisins.suivant}
          sens="suivant"
          hrefBase="/certificats"
          entite="Certificat"
        />
      </div>
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
        {/* L'attestation de l'autorité, le bon de commande signé, le recueil
            d'identité : les pièces se lisent sous la fiche qu'elles attestent. */}
        <DocumentsPanel
          parent={{ certificatId: id }}
          readOnly={!isAdmin}
          categories={categories.map((c) => ({ id: c.id, label: c.label }))}
          documents={certificat.documents.map((d) => ({
            id: d.id,
            nomOriginal: d.nomOriginal,
            categorieId: d.categorieId,
            categorie: d.categorie?.label ?? null,
            taille: d.taille,
            deposeParLabel: d.deposeParLabel,
            createdAt: FMT_DEPOT.format(d.createdAt),
          }))}
        />

        {/* La carte des codes n'est pas rendue au lecteur — et l'action qu'elle
            appelle exige de toute façon le rôle admin. */}
        {isAdmin ? <CodesPanel id={id} /> : null}
      </CertificatForm>
    </>
  );
}
