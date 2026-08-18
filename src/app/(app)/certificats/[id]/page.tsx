import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsPanel } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { ModeFicheProvider } from "@/components/mode-fiche";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { nomTitulaire } from "@/schemas/certificat";
import { requireUser } from "@/server/guards";
import { getCertificat, voisinsCertificat } from "@/server/services/certificats";
import { listEditeurs } from "@/server/services/editeurs";
import { listCategoriesDocuments, listServicesUtilisateurs } from "@/server/services/referentiels";
import { listServeurs } from "@/server/services/serveurs";
import { CertificatForm } from "../certificat-form";
import { CodesPanel } from "../codes-panel";
import { ongletCertificat } from "../onglets";

export const metadata: Metadata = { title: "Certificat" };

/** Horodatage d'un dépôt : une heure locale, pas une date de calendrier. */
const FMT_DEPOT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeZone: "Europe/Paris",
});

/** Les <input type="date"> attendent AAAA-MM-JJ ; la base rend des dates UTC. */
const jour = (d: Date | null) => (d === null ? "" : d.toISOString().slice(0, 10));
const texte = (v: number | string | null) => (v === null ? "" : String(v));

export default async function CertificatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
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

  const { onglet } = await searchParams;
  const actif = ongletCertificat(onglet);

  return (
    <>
      {/* L'en-tête est encadré des flèches de navigation : on parcourt ainsi
          les certificats sans repasser par la liste, DANS SON ORDRE — du plus
          pressant au plus lointain, puisque c'est par échéance qu'elle est
          rangée. La fiche logiciel, elle, se parcourt alphabétiquement : chaque
          liste impose son ordre à ses flèches. On reste sur le MÊME onglet en
          changeant de certificat. */}
      <div className="mb-4 flex items-start gap-2">
        <FlecheVoisin
          voisin={voisins.precedent}
          sens="precedent"
          hrefBase="/certificats"
          query={`?onglet=${actif}`}
          entite="Certificat"
        />
        <div className="min-w-0 flex-1">
          {/* Le sous-titre dit QUI, les actions disent CHEZ QUI. L'autorité n'y
              est pas qu'un mot : c'est chez elle qu'on renouvelle et qu'on
              révoque, sa fiche porte l'adresse et les contacts, elle mérite donc
              d'être un lien plutôt qu'une mention accolée à la fonction. */}
          <PageHeader
            className=""
            title={nomTitulaire(certificat)}
            subtitle={certificat.fonction || "Certificat électronique"}
            actions={
              certificat.fournisseur ? (
                <Link
                  href={`/editeurs/${certificat.fournisseur.id}`}
                  title={`Ouvrir la fiche de ${certificat.fournisseur.nom}`}
                  className="text-sm font-medium text-muted hover:text-accent"
                >
                  {certificat.fournisseur.nom}
                </Link>
              ) : undefined
            }
          />
        </div>
        <FlecheVoisin
          voisin={voisins.suivant}
          sens="suivant"
          hrefBase="/certificats"
          query={`?onglet=${actif}`}
          entite="Certificat"
        />
      </div>

      {/* UN mode de modification pour la fiche ENTIÈRE, et TROIS onglets tous
          montés — la barre vit dans CertificatForm. Le crayon ouvre les trois
          cartes du certificat, mais aussi ses documents et la saisie des codes
          de l'autorité — les LIRE reste hors du mode. */}
      <ModeFicheProvider readOnly={!isAdmin} objet="ce certificat">
        <CertificatForm
          id={id}
          readOnly={!isAdmin}
          onglet={actif}
          editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
          services={services.map((s) => ({ id: s.id, nom: s.nom }))}
          serveurs={serveurs.map((s) => ({ id: s.id, nom: s.nom }))}
          values={{
            civilite: certificat.civilite ?? "",
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
          // L'attestation de l'autorité, le bon de commande signé, le recueil
          // d'identité : les pièces d'un certificat, sous leur propre onglet.
          documents={
            // `key` sur les éléments-slots, comme sur les autres fiches :
            // désérialisés du flux RSC au rendu serveur, React les tient pour
            // les membres d'une liste et réclame sinon une clé.
            <DocumentsPanel
              key="documents"
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
          }
          // La carte des codes n'est pas rendue au lecteur — l'onglet Révocation
          // disparaît avec elle, et l'action qu'elle appelle exige de toute
          // façon le rôle admin.
          codes={isAdmin ? <CodesPanel key="codes" id={id} /> : undefined}
        />
      </ModeFicheProvider>
    </>
  );
}
