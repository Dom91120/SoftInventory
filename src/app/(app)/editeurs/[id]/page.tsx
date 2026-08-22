import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsPanel } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { ModeFicheProvider } from "@/components/mode-fiche";
import { Card, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC } from "@/lib/format";
import { nomTitulaire } from "@/schemas/certificat";
import { LIBELLES_CATEGORIE_EDITEUR } from "@/schemas/editeur";
import { requireUser } from "@/server/guards";
import { getEditeur, logicielsFournisPar, voisinsEditeur } from "@/server/services/editeurs";
import { listCategoriesDocuments } from "@/server/services/referentiels";
import { joursAvantExpiration, pastilleValidite } from "../../certificats/shared";
import { EditeurForm } from "../editeur-form";
import { ongletEditeur } from "../onglets";

/** La voie par laquelle une société fournit un logiciel, en marge du nom. */
const LIBELLES_VOIE = { marche: "marché", devis: "devis" } as const;

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
  const logicielsFournis = logicielsFournisPar(editeur);
  const aujourdhui = new Date();
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
          {/* Le sous-titre dit ce qu'EST la société — « Autorité de
              certification », pas un « Fiche éditeur » qui mentirait sur les
              fournisseurs et les autorités. */}
          <PageHeader
            className=""
            title={editeur.nom}
            subtitle={
              LIBELLES_CATEGORIE_EDITEUR[editeur.categorie] + (isAdmin ? "" : " (lecture seule)")
            }
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
            categorie: editeur.categorie,
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
            // Chaque carte ne se montre que si elle a quelque chose à dire :
            // une carte vide n'apprenait rien qu'une absence, et la fiche
            // d'une société sans aucun lien se lit sans ces deux pavés.
            <>
              {editeur.logiciels.length > 0 && (
                <Card key="logiciels" title="Logiciels de cet éditeur">
                  {/* Sans filets entre les lignes, comme les cartes de l'onglet
                      Liaisons d'un logiciel : les logiciels d'un même éditeur
                      se lisent comme une liste, pas comme des données
                      distinctes qu'il faudrait séparer. */}
                  <ul className="text-sm">
                    {editeur.logiciels.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/logiciels/${l.id}`}
                          className="font-medium text-strong hover:text-accent"
                        >
                          {l.nom}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {/* Ce qu'elle nous VEND sans le faire : les logiciels atteints
                  par un marché dont elle est fournisseur, ou par un devis
                  qu'elle a remis — ceux qu'elle édite restent dans la carte
                  du dessus, qui les dit déjà. Un revendeur pur n'a rien
                  là-haut, et c'est ici que sa fiche dit à quoi il sert.
                  Chaque logiciel une fois, la voie en marge. */}
              {logicielsFournis.length > 0 && (
                <Card key="fournis" title="Logiciels fournis" hint="par marché ou devis">
                  <ul className="text-sm">
                    {logicielsFournis.map((l) => (
                      <li key={l.id} className="flex items-baseline gap-x-2">
                        <Link
                          href={`/logiciels/${l.id}`}
                          className="font-medium text-strong hover:text-accent"
                        >
                          {l.nom}
                        </Link>
                        <span className="text-xs text-faint">
                          {l.voies.map((v) => LIBELLES_VOIE[v]).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {/* Pour une AUTORITÉ, ce sont ses certificats qui disent à quoi
                  elle sert — elle n'édite ni ne fournit de logiciel. Le
                  titulaire mène à la fiche du certificat, la pastille dit où
                  en est sa validité, comme sur la liste des certificats. */}
              {editeur.categorie === "autorite_certification" && editeur.certificats.length > 0 && (
                <Card key="certificats" title="Certificats délivrés">
                  {/* Une GRILLE et non des lignes en flex : la date et la
                      pastille forment des colonnes dont la largeur est
                      partagée par toutes les lignes — en flex, « dans 56 j »
                      et « dans 329 j » décalaient la date de chaque ligne
                      selon la largeur de sa propre pastille. Les <li> sont en
                      `contents` pour que leurs cellules tombent dans la grille
                      du <ul>. */}
                  <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 text-sm">
                    {editeur.certificats.map((c) => {
                      const pastille = pastilleValidite(
                        c,
                        joursAvantExpiration(c.dateFin, aujourdhui),
                      );
                      return (
                        <li key={c.id} className="contents">
                          <span className="min-w-0 pt-2">
                            <Link
                              href={`/certificats/${c.id}`}
                              className="block truncate font-medium text-strong hover:text-accent"
                            >
                              {nomTitulaire(c)}
                            </Link>
                            <span className="block truncate text-xs text-faint">
                              {[c.fonction, c.service?.nom].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="whitespace-nowrap pt-2 text-xs text-muted tabular-nums">
                            {c.dateFin ? DATE_FMT_FR_UTC.format(c.dateFin) : "—"}
                          </span>
                          <span className="pt-2">
                            <span className={pastille.classe}>
                              <CalendarClock className="h-3.5 w-3.5" />
                              {pastille.texte}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </>
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
