import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsPanel } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { ModeFicheProvider } from "@/components/mode-fiche";
import { Card, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { requireUser } from "@/server/guards";
import { getEditeur, voisinsEditeur } from "@/server/services/editeurs";
import { listCategoriesDocuments } from "@/server/services/referentiels";
import { EditeurForm } from "../editeur-form";
import { ongletEditeur } from "../onglets";

export const metadata: Metadata = { title: "Éditeur" };

export default async function EditeurPage({
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
  const [editeur, categories, voisins] = await Promise.all([
    getEditeur(id),
    listCategoriesDocuments(),
    voisinsEditeur(id),
  ]);
  if (!editeur) notFound();
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });

  const { onglet } = await searchParams;
  const actif = ongletEditeur(onglet);

  return (
    <>
      {/* L'en-tête est encadré des flèches de navigation : on reste sur le MÊME
          onglet en changeant d'éditeur, comme sur la fiche logiciel. */}
      <div className="mb-3 flex items-start gap-2">
        <FlecheVoisin
          voisin={voisins.precedent}
          sens="precedent"
          hrefBase="/editeurs"
          query={`?onglet=${actif}`}
          entite="Éditeur"
        />
        <div className="min-w-0 flex-1">
          {/* « — modifiable » disait à l'admin ce que les champs actifs et le
              bouton d'enregistrement lui montrent déjà. La mention de lecture
              seule reste : elle, apprend quelque chose. */}
          <PageHeader
            className=""
            title={editeur.nom}
            subtitle={isAdmin ? "Fiche éditeur" : "Fiche éditeur (lecture seule)"}
          />
        </div>
        <FlecheVoisin
          voisin={voisins.suivant}
          sens="suivant"
          hrefBase="/editeurs"
          query={`?onglet=${actif}`}
          entite="Éditeur"
        />
      </div>

      {/* UN mode de modification pour la fiche ENTIÈRE, et TROIS onglets tous
          montés — la barre vit dans EditeurForm : Synthèse et Contacts
          saisissent le même enregistrement, le <form> doit envelopper les
          onglets, et lui seul peut le faire. */}
      <ModeFicheProvider readOnly={!isAdmin} objet="cette fiche">
        <EditeurForm
          id={editeur.id}
          readOnly={!isAdmin}
          nbPiecesJointes={editeur.documents.length}
          onglet={actif}
          values={{
            nom: editeur.nom,
            adresse: editeur.adresse,
            codePostal: editeur.codePostal,
            ville: editeur.ville,
            telephone: editeur.telephone,
            email: editeur.email,
            siteWeb: editeur.siteWeb,
            supportUrl: editeur.supportUrl,
            supportEmail: editeur.supportEmail,
            supportTelephone: editeur.supportTelephone,
            numeroClient: editeur.numeroClient,
            supportHoraires: editeur.supportHoraires,
            supportHoraires2: editeur.supportHoraires2,
            commercialContact: editeur.commercialContact,
            commercialTelephone: editeur.commercialTelephone,
            commercialEmail: editeur.commercialEmail,
            commercialContact2: editeur.commercialContact2,
            commercialTelephone2: editeur.commercialTelephone2,
            commercialEmail2: editeur.commercialEmail2,
            adminContact: editeur.adminContact,
            adminTelephone: editeur.adminTelephone,
            adminEmail: editeur.adminEmail,
            dpoContact: editeur.dpoContact,
            dpoTelephone: editeur.dpoTelephone,
            dpoEmail: editeur.dpoEmail,
            notes: editeur.notes,
          }}
          logiciels={
            // `key` sur les éléments-slots, comme sur la fiche marché :
            // désérialisés du flux RSC au rendu serveur, React les tient pour
            // les membres d'une liste et peut réclamer une clé.
            <Card key="logiciels" title="Logiciels de cet éditeur">
              {editeur.logiciels.length === 0 ? (
                <p className="text-sm text-faint">
                  Aucun logiciel de l'inventaire ne lui est rattaché.
                </p>
              ) : (
                // Sans filets entre les lignes, comme les cartes de l'onglet
                // Liaisons d'un logiciel : les logiciels d'un même éditeur se
                // lisent comme une liste, pas comme des données distinctes
                // qu'il faudrait séparer.
                <ul className="text-sm">
                  {editeur.logiciels.map((l) => (
                    <li key={l.id} className="pt-2">
                      <Link
                        href={`/logiciels/${l.id}`}
                        className="font-medium text-strong hover:text-accent"
                      >
                        {l.nom}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          }
          documents={
            <DocumentsPanel
              key="documents"
              parent={{ editeurId: editeur.id }}
              readOnly={!isAdmin}
              categorieParDefaut="Présentation commerciale"
              categories={categories.map((c) => ({ id: c.id, label: c.label }))}
              documents={editeur.documents.map((d) => ({
                id: d.id,
                nomOriginal: d.nomOriginal,
                categorieId: d.categorieId,
                categorie: d.categorie?.label ?? null,
                taille: d.taille,
                deposeParLabel: d.deposeParLabel,
                createdAt: fmt.format(d.createdAt),
              }))}
            />
          }
        />
      </ModeFicheProvider>
    </>
  );
}
