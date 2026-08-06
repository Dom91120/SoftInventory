import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LigneDocument } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC } from "@/lib/format";
import { requireUser } from "@/server/guards";
import {
  getContratComplet,
  listLogicielsPourRattachement,
  nomDe,
  voisinsContrat,
} from "@/server/services/contrats";
import { listEditeurs } from "@/server/services/editeurs";
import { listCategoriesDocuments } from "@/server/services/referentiels";
import { ContratForm } from "../contrat-form";

export const metadata: Metadata = { title: "Contrat / marché" };

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();
  const [contrat, editeurs, logiciels, categories, voisins] = await Promise.all([
    getContratComplet(id),
    listEditeurs(),
    listLogicielsPourRattachement(),
    listCategoriesDocuments(),
    voisinsContrat(id),
  ]);
  if (!contrat) notFound();

  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  const optionsCategories = categories.map((c) => ({ id: c.id, label: c.label }));

  return (
    <>
      <div className="mb-3 flex items-start gap-2">
        <FlecheVoisin
          voisin={voisins.precedent}
          sens="precedent"
          hrefBase="/contrats"
          entite="Marché"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            className=""
            title={nomDe(contrat)}
            subtitle={
              isAdmin
                ? "Fiche contrat / marché — modifiable"
                : "Fiche contrat / marché (lecture seule)"
            }
          />
        </div>
        <FlecheVoisin
          voisin={voisins.suivant}
          sens="suivant"
          hrefBase="/contrats"
          entite="Marché"
        />
      </div>

      <ContratForm
        id={contrat.id}
        readOnly={!isAdmin}
        editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
        logiciels={logiciels}
        values={{
          referenceMarche: contrat.referenceMarche,
          libelle: contrat.libelle,
          fournisseurId: contrat.fournisseurId === null ? "" : String(contrat.fournisseurId),
          montantAnnuel: contrat.montantAnnuel === null ? "" : String(contrat.montantAnnuel),
          montantMaxi: contrat.montantMaxi === null ? "" : String(contrat.montantMaxi),
          montantTotal: contrat.montantTotal === null ? "" : String(contrat.montantTotal),
          dateDebut: dateStr(contrat.dateDebut),
          dateFin: dateStr(contrat.dateFin),
          notes: contrat.notes,
          logicielIds: contrat.logiciels.map((l) => String(l.logiciel.id)),
        }}
      >
        {/* Les pièces se LISENT ici et se saisissent depuis l'onglet
            Contrats/Marchés d'un logiciel couvert : c'est là que vit le
            formulaire de dépôt, avec son enchaînement « créer la pièce puis
            déposer son fichier ». */}
        <Card title="Pièces du marché">
          {contrat.pieces.length === 0 ? (
            <EmptyState>
              Aucune pièce.{" "}
              {contrat.logiciels.length > 0
                ? "Elles s'ajoutent depuis l'onglet Contrats/Marchés d'un logiciel couvert."
                : "Rattachez d'abord un logiciel : c'est depuis son onglet Contrats/Marchés que les pièces se déposent."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {contrat.pieces.map((p) => (
                <li key={p.id} className="py-2">
                  {p.documents.length === 0 ? (
                    <span className="text-faint">
                      Pièce sans fichier
                      {p.datePiece ? ` · ${DATE_FMT_FR_UTC.format(p.datePiece)}` : ""}
                    </span>
                  ) : (
                    p.documents.map((d) => (
                      <LigneDocument
                        key={d.id}
                        readOnly
                        categorieModifiable={false}
                        categories={optionsCategories}
                        dateLigne={p.datePiece ? DATE_FMT_FR_UTC.format(p.datePiece) : null}
                        document={{
                          id: d.id,
                          nomOriginal: d.nomOriginal,
                          categorieId: d.categorieId,
                          categorie: d.categorie?.label ?? null,
                          taille: d.taille,
                          deposeParLabel: d.deposeParLabel,
                          createdAt: fmt.format(d.createdAt),
                        }}
                      />
                    ))
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Les cases du dessus DÉSIGNENT les logiciels ; cette carte y MÈNE.
            Deux gestes distincts, d'où deux cartes — un lien dans un label de
            case se déclencherait en cochant. Rien à afficher quand le marché
            ne couvre encore rien : la carte de saisie le dit déjà. */}
        {contrat.logiciels.length === 0 ? null : (
          <Card title="Ouvrir un logiciel couvert">
            <ul className="divide-y divide-line text-sm">
              {contrat.logiciels.map((l) => (
                <li key={l.logiciel.id} className="py-2">
                  <Link
                    href={`/logiciels/${l.logiciel.id}?onglet=contrats`}
                    className="font-medium text-strong hover:text-accent"
                  >
                    {l.logiciel.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </ContratForm>
    </>
  );
}
