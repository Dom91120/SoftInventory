import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LigneDocument } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { DATE_FMT_FR_UTC } from "@/lib/format";
import { dateCalendaire } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { requireUser } from "@/server/guards";
import {
  etatMarche,
  getContratComplet,
  listLogicielsPourRattachement,
  titreDe,
  voisinsContrat,
} from "@/server/services/contrats";
import { listEditeurs } from "@/server/services/editeurs";
import { listCategoriesDocuments } from "@/server/services/referentiels";
import { ContratForm } from "../contrat-form";
import { LogicielsCouverts } from "../logiciels-couverts";

export const metadata: Metadata = { title: "Contrat / marché" };

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();
  const [contrat, editeurs, logiciels, categories, voisins, { contrat: seuilJours }] =
    await Promise.all([
      getContratComplet(id),
      listEditeurs(),
      listLogicielsPourRattachement(),
      listCategoriesDocuments(),
      voisinsContrat(id),
      seuilsRappel(),
    ]);
  if (!contrat) notFound();

  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  const optionsCategories = categories.map((c) => ({ id: c.id, label: c.label }));

  // Même fenêtre que les rappels par e-mail et la liste : « À renouveler »
  // paraît quand le cron s'apprête à écrire.
  const jour = dateCalendaire(new Date());
  const etat = etatMarche(
    contrat.dateFin,
    jour,
    new Date(jour.getTime() + seuilJours * 86_400_000),
  );
  const PASTILLE = {
    termine: { classe: "badge-muted", texte: "Terminé" },
    a_renouveler: { classe: "badge-warn", texte: "À renouveler" },
    en_cours: { classe: "badge-ok", texte: "En cours" },
  }[etat];

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
          {/* Le sous-titre est rendu ICI plutôt que par `PageHeader` : il
              partage sa ligne avec le raccourci vers le fournisseur, à la
              place qu'occupe « Fiche éditeur » sur la fiche logiciel. Le nom du
              fournisseur n'est pas répété — le champ de la carte, juste
              dessous, le porte déjà. */}
          {/* Disposition de la fiche logiciel : la pastille d'état sur la ligne
              du TITRE (slot `actions`), le raccourci sur celle du sous-titre. */}
          <PageHeader
            className=""
            title={titreDe(contrat)}
            actions={<span className={PASTILLE.classe}>{PASTILLE.texte}</span>}
          />
          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">{contrat.referenceMarche}</p>
            {contrat.fournisseur ? (
              <Link
                href={`/editeurs/${contrat.fournisseur.id}`}
                className="text-sm font-medium text-muted hover:text-accent"
              >
                Fiche fournisseur
              </Link>
            ) : null}
          </div>
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
        }}
      >
        <LogicielsCouverts
          contratId={contrat.id}
          readOnly={!isAdmin}
          rattaches={contrat.logiciels.map((l) => ({ id: l.logiciel.id, nom: l.logiciel.nom }))}
          // Le reste de l'inventaire : la liste de rattachement ne propose que
          // ce qui n'est pas déjà couvert.
          disponibles={logiciels.filter(
            (l) => !contrat.logiciels.some((r) => r.logiciel.id === l.id),
          )}
        />
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
      </ContratForm>
    </>
  );
}
