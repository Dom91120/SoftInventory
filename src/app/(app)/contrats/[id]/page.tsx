import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ID_COMMANDES_ONGLET } from "@/components/commandes-onglet";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { ModeFicheProvider } from "@/components/mode-fiche";
import { Onglets, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
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
import { PiecesMarche } from "../pieces-marche";
import { queryTri, triContratsDepuisParams } from "../shared";

export const metadata: Metadata = { title: "Contrat / marché" };

/**
 * Catégorie proposée d'office au dépôt d'une pièce, comme dans l'onglet
 * Contrats/Marchés d'un logiciel. Rapprochée par LIBELLÉ : le référentiel est
 * saisi par l'admin, l'entrée peut manquer — d'où le repli sur null.
 */
const CATEGORIE_PAR_DEFAUT = "Contrat";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ContratPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireUser();
  const isAdmin = (session.user as { role?: Role }).role === "admin";

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();

  // L'ordre de la liste d'où l'on vient, porté par l'URL : les flèches
  // « précédent / suivant » parcourent les marchés dans CET ordre, et le
  // repassent à la fiche suivante pour que la chaîne ne se rompe pas.
  const query = await searchParams;
  const { tri, sens } = triContratsDepuisParams(query);
  const qTri = queryTri(query);
  const jour = dateCalendaire(new Date());

  const [contrat, editeurs, logiciels, categories, { contrat: seuilJours }] = await Promise.all([
    getContratComplet(id),
    listEditeurs(),
    listLogicielsPourRattachement(),
    listCategoriesDocuments(),
    seuilsRappel(),
  ]);
  if (!contrat) notFound();

  const voisins = await voisinsContrat(
    id,
    tri,
    sens,
    jour,
    new Date(jour.getTime() + seuilJours * 86_400_000),
  );

  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  const optionsCategories = categories.map((c) => ({ id: c.id, label: c.label }));

  // Même fenêtre que les rappels par e-mail et la liste : « À renouveler »
  // paraît quand le cron s'apprête à écrire. `jour` est déjà posé plus haut,
  // les flèches en ayant besoin pour ordonner sur la colonne État.
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
          query={qTri}
          entite="Marché"
        />
        <div className="min-w-0 flex-1">
          {/* Le sous-titre est rendu ICI plutôt que par `PageHeader` : il
              partage sa ligne avec le raccourci vers le fournisseur, à la
              place qu'occupe « Fiche éditeur » sur la fiche logiciel. Le nom du
              fournisseur n'est pas répété — le champ de la carte, juste
              dessous, le porte déjà. */}
          {/* La pastille d'état tient le bout de la ligne du TITRE, comme les
              pastilles de statut et de criticité sur la fiche d'un logiciel :
              l'état se lit d'un coup d'œil, toujours au même endroit, sans
              dépendre de la longueur du nom qui le précède. */}
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
          query={qTri}
          entite="Marché"
        />
      </div>

      {/* Un onglet unique : cette fiche n'en a pas plusieurs à proposer, mais
          la barre est ce qui porte le crayon, au même bout de ligne que sur la
          fiche logiciel. */}
      <Onglets
        onglets={[{ key: "fiche", label: "Contrat/Marché" }]}
        actif="fiche"
        href={() => `/contrats/${contrat.id}`}
        idActions={ID_COMMANDES_ONGLET}
      />

      {/* UN mode de modification pour la fiche ENTIÈRE : le crayon de la barre
          ouvre le formulaire du marché, mais aussi les logiciels couverts et
          les pièces — tout ce que la page permet de changer. */}
      <ModeFicheProvider readOnly={!isAdmin} objet="ce marché">
        <ContratForm
          id={contrat.id}
          readOnly={!isAdmin}
          editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
          values={{
            nature: contrat.nature ?? "",
            referenceMarche: contrat.referenceMarche,
            referenceFournisseur: contrat.referenceFournisseur,
            libelle: contrat.libelle,
            fournisseurId: contrat.fournisseurId === null ? "" : String(contrat.fournisseurId),
            montantAnnuel: contrat.montantAnnuel === null ? "" : String(contrat.montantAnnuel),
            montantMaxi: contrat.montantMaxi === null ? "" : String(contrat.montantMaxi),
            montantTotal: contrat.montantTotal === null ? "" : String(contrat.montantTotal),
            dateDebut: dateStr(contrat.dateDebut),
            dateFin: dateStr(contrat.dateFin),
            dureeAnnees: contrat.dureeAnnees === null ? "" : String(contrat.dureeAnnees),
            renouvellements:
              contrat.renouvellements === null ? "" : String(contrat.renouvellements),
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
          {/* Les pièces se saisissent ICI, avec le même formulaire que l'onglet
            d'un logiciel : c'est ce qui rend utilisable un marché qui ne couvre
            encore rien. Une pièce n'a qu'UN fichier — d'où le premier document
            et lui seul, les éventuels autres étant hérités d'avant cette règle. */}
          <PiecesMarche
            contratId={contrat.id}
            readOnly={!isAdmin}
            categories={optionsCategories}
            categorieParDefautId={
              categories.find((c) => c.label === CATEGORIE_PAR_DEFAUT)?.id ?? null
            }
            pieces={contrat.pieces.map((p) => {
              const d = p.documents[0];
              return {
                id: p.id,
                datePiece: dateStr(p.datePiece),
                document: d
                  ? {
                      id: d.id,
                      nomOriginal: d.nomOriginal,
                      categorieId: d.categorieId,
                      categorie: d.categorie?.label ?? null,
                      taille: d.taille,
                      deposeParLabel: d.deposeParLabel,
                      createdAt: fmt.format(d.createdAt),
                    }
                  : null,
              };
            })}
          />
        </ContratForm>
      </ModeFicheProvider>
    </>
  );
}
