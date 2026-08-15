import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BoutonQuitter } from "@/components/bouton-quitter";
import { DocumentsPanel } from "@/components/documents-panel";
import { FicheOnglets } from "@/components/fiche-onglets";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { LigneActionsFiche, ModeFicheProvider } from "@/components/mode-fiche";
import { EcheanceBadge } from "@/components/tache-badges";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { dateCalendaire } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";
import { listMarchesPourRattachement } from "@/server/services/contrats";
import { listEditeurs } from "@/server/services/editeurs";
import { getLogiciel, listAutresLogiciels, voisinsLogiciel } from "@/server/services/logiciels";
import {
  listCategoriesDocuments,
  listCriticites,
  listModesHebergement,
  listServicesUtilisateurs,
  listStatutsLogiciels,
  listTechnologies,
  listTypesTaches,
} from "@/server/services/referentiels";
import { listServeurs } from "@/server/services/serveurs";
import { listTachesDuLogiciel } from "@/server/services/taches";
import { BoutonSupprimerLogiciel } from "../bouton-supprimer";
import { FicheForm } from "../fiche-form";
import { CriticiteBadge, StatutBadge } from "../shared";
import { type ContratRow, ContratsPanel } from "./contrats-panel";
import { type ConsultationRow, DevisPanel } from "./devis-panel";
import { LiaisonsPanel } from "./liaisons-panel";
import { RgpdPanel } from "./rgpd-panel";
import { SupportPanel } from "./support-panel";
import { TachesPanel } from "./taches-panel";

export const metadata: Metadata = { title: "Logiciel" };

const ONGLETS = [
  { key: "synthese", label: "Synthèse" },
  // Même raison que « contrats » plus bas : la clé reste « support », elle
  // circule dans les favoris. Seul le libellé change — l'onglet ne montre plus
  // que l'assistance depuis qu'il porte aussi le commercial et l'administratif.
  { key: "support", label: "Contacts" },
  { key: "liaisons", label: "Liaisons" },
  // La clé reste « contrats », elle circule dans les favoris. Seul le libellé
  // change.
  { key: "contrats", label: "Contrats/Marchés" },
  // Les devis précèdent les tâches : ils racontent l'AVANT-contrat (mise en
  // concurrence), et se lisent juste après le contrat qui en est issu.
  { key: "devis", label: "Devis" },
  { key: "taches", label: "Tâches" },
  { key: "documents", label: "Documents" },
  { key: "rgpd", label: "RGPD" },
] as const;
type OngletKey = (typeof ONGLETS)[number]["key"];

/**
 * Applications faites par la DSI : le marqueur remplace l'ancien éditeur
 * sentinelle du même nom, et « Édité par… » n'aurait pas de sens ici.
 */
const LIBELLE_INTERNE = "Développement interne";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * Pièces jointes de la fiche, TOUS chemins de cascade confondus : les siennes,
 * celles de ses marchés, celles de ses devis — le même compte qu'applique
 * `compterPiecesLogiciel` côté serveur, qui refuse la suppression tant qu'il
 * n'est pas nul.
 */
function compterPieces(l: LogicielComplet): number {
  return (
    l.documents.length +
    l.contrats.reduce((n, c) => n + c.pieces.reduce((m, p) => m + p.documents.length, 0), 0) +
    l.consultations.reduce((n, c) => n + c.devis.reduce((m, d) => m + d.documents.length, 0), 0)
  );
}

export default async function LogicielPage({
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
  const [logiciel, statuts] = await Promise.all([getLogiciel(id), listStatutsLogiciels()]);
  if (!logiciel) notFound();

  const { onglet } = await searchParams;
  // Tout ce qui n'est pas une clé connue retombe sur la Synthèse.
  const actif: OngletKey = ONGLETS.some((o) => o.key === onglet)
    ? (onglet as OngletKey)
    : "synthese";

  const { precedent, suivant } = await voisinsLogiciel(id);

  /** La corbeille de la fiche — la même sur chaque onglet qui la montre. */
  const corbeille = isAdmin ? (
    <BoutonSupprimerLogiciel id={id} nom={logiciel.nom} nbPiecesJointes={compterPieces(logiciel)} />
  ) : undefined;

  /**
   * La ligne du bas des onglets SANS formulaire propre : « Quitter » fiche
   * fermée, « Enregistrer »/« Annuler » de la FICHE ENTIÈRE dès qu'elle est
   * ouverte — les deux issues du mode se trouvent ainsi sous chaque onglet. La
   * Synthèse, les Liaisons et le volet RGPD portent leur propre ligne, qui dit
   * la même chose ; ils reçoivent la corbeille en prop plutôt que cette rangée.
   */
  const rangeeQuitter = (
    <LigneActionsFiche
      quitter={<BoutonQuitter vers="/logiciels" titre="Revenir à la liste des logiciels" />}
      // La corbeille garde son bout de ligne, comme sur la Synthèse : elle
      // porte sur la fiche entière, pas sur l'onglet qu'on regarde.
      supprimer={corbeille}
    />
  );

  return (
    <>
      {/* L'en-tête est encadré des flèches de navigation : on reste sur le
          MÊME onglet en changeant de logiciel, ce qui permet de parcourir
          l'inventaire onglet par onglet (les documents de l'un, puis de
          l'autre…). */}
      <div className="mb-3 flex items-start gap-2">
        <FlecheVoisin
          voisin={precedent}
          sens="precedent"
          hrefBase="/logiciels"
          query={`?onglet=${actif}`}
          entite="Logiciel"
        />
        <div className="min-w-0 flex-1">
          {/* Le titre et le STATUT occupent la première rangée ; d'où vient le
              logiciel et ce que son arrêt coûterait forment la seconde, d'où le
              sous-titre rendu ici plutôt que confié à PageHeader.
              La criticité est descendue d'un rang, à la place qu'occupait le
              raccourci « Fiche éditeur » : le statut dit où en est le logiciel
              et se lit avec son nom, la criticité pèse son importance et n'a
              pas à se disputer cette ligne-là. */}
          <PageHeader
            className=""
            title={
              <span className="flex flex-wrap items-center gap-2">
                {logiciel.nom}
                {/* Ouvrir l'application : accolée au nom, réduite à son icône.
                    C'est l'action qui porte sur le logiciel lui-même, pas sur sa
                    fiche — sa place est donc contre son nom, et le libellé
                    n'apprend rien qu'un lien externe ne dise déjà. */}
                {logiciel.url ? (
                  <a
                    href={logiciel.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-ghost !p-1.5 text-muted hover:text-accent"
                    title="Ouvrir l'application"
                    aria-label="Ouvrir l'application"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                ) : null}
              </span>
            }
            actions={<StatutBadge statut={logiciel.statut} statuts={statuts} />}
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
            {/* Le NOM de l'éditeur mène à sa fiche, et se porte en gras :
                  c'est un nom d'objet de l'inventaire, comme le serveur d'une
                  installation ou le logiciel d'une interconnexion — partout
                  ailleurs, un tel nom est un lien vers cet objet. « Édité
                  par », qui n'est qu'une tournure, garde le gris du
                  sous-titre. Rien à lier pour du développement interne : il n'y
                  a pas de société derrière. */}
            <p className="text-sm text-muted">
              {logiciel.developpementInterne || !logiciel.editeur ? (
                logiciel.developpementInterne ? (
                  LIBELLE_INTERNE
                ) : null
              ) : (
                <>
                  Édité par{" "}
                  <Link
                    href={`/editeurs/${logiciel.editeur.id}`}
                    className="font-semibold text-strong transition hover:text-accent"
                  >
                    {logiciel.editeur.nom}
                  </Link>
                </>
              )}
            </p>
            {/* La criticité prend la place du raccourci « Fiche éditeur », qui
                a disparu : le nom de l'éditeur, juste à gauche, mène au même
                endroit — deux liens pour une seule destination sur une seule
                ligne. */}
            <span className="ml-auto flex items-center gap-2">
              <CriticiteBadge criticite={logiciel.criticite} />
            </span>
          </div>
        </div>
        <FlecheVoisin
          voisin={suivant}
          sens="suivant"
          hrefBase="/logiciels"
          query={`?onglet=${actif}`}
          entite="Logiciel"
        />
      </div>

      {/* UN mode de modification pour la fiche entière, et TOUS les panneaux
          montés : le crayon de la barre d'onglets vaut pour chaque onglet, et
          une saisie commencée sur l'un survit à un détour par un autre —
          `FicheOnglets` masque les panneaux au lieu de les démonter. */}
      <ModeFicheProvider
        readOnly={!isAdmin}
        objet="cette fiche"
        detailFermeture="Les modifications en cours, sur tous les onglets, seront perdues."
      >
        <FicheOnglets
          onglets={ONGLETS}
          initial={actif}
          base={`/logiciels/${id}`}
          panneaux={{
            synthese: <OngletSynthese logiciel={logiciel} readOnly={!isAdmin} />,
            support: (
              <>
                <SupportPanel
                  editeur={
                    logiciel.editeur
                      ? {
                          id: logiciel.editeur.id,
                          nom: logiciel.editeur.nom,
                          supportUrl: logiciel.editeur.supportUrl,
                          supportEmail: logiciel.editeur.supportEmail,
                          supportTelephone: logiciel.editeur.supportTelephone,
                          numeroClient: logiciel.editeur.numeroClient,
                          supportHoraires: logiciel.editeur.supportHoraires,
                          supportHoraires2: logiciel.editeur.supportHoraires2,
                          commercialContact: logiciel.editeur.commercialContact,
                          commercialTelephone: logiciel.editeur.commercialTelephone,
                          commercialEmail: logiciel.editeur.commercialEmail,
                          commercialContact2: logiciel.editeur.commercialContact2,
                          commercialTelephone2: logiciel.editeur.commercialTelephone2,
                          commercialEmail2: logiciel.editeur.commercialEmail2,
                          adminContact: logiciel.editeur.adminContact,
                          adminTelephone: logiciel.editeur.adminTelephone,
                          adminEmail: logiciel.editeur.adminEmail,
                          dpoContact: logiciel.editeur.dpoContact,
                          dpoTelephone: logiciel.editeur.dpoTelephone,
                          dpoEmail: logiciel.editeur.dpoEmail,
                        }
                      : null
                  }
                />
                {rangeeQuitter}
              </>
            ),
            liaisons: (
              <OngletLiaisons logiciel={logiciel} readOnly={!isAdmin} supprimer={corbeille} />
            ),
            contrats: (
              <>
                <OngletContrats logiciel={logiciel} readOnly={!isAdmin} />
                {rangeeQuitter}
              </>
            ),
            devis: (
              <>
                <OngletDevis logiciel={logiciel} readOnly={!isAdmin} />
                {rangeeQuitter}
              </>
            ),
            taches: (
              <>
                <OngletTaches logicielId={id} readOnly={!isAdmin} />
                {rangeeQuitter}
              </>
            ),
            documents: (
              <>
                <OngletDocuments logiciel={logiciel} readOnly={!isAdmin} />
                {rangeeQuitter}
              </>
            ),
            rgpd: (
              <RgpdPanel
                logicielId={id}
                readOnly={!isAdmin}
                supprimer={corbeille}
                values={{
                  donneesPersonnelles: logiciel.donneesPersonnelles,
                  categoriesDonnees: logiciel.categoriesDonnees,
                  registreRef: logiciel.registreRef,
                  localisationDonnees: logiciel.localisationDonnees,
                }}
              />
            ),
          }}
        />
      </ModeFicheProvider>
    </>
  );
}

type LogicielComplet = NonNullable<Awaited<ReturnType<typeof getLogiciel>>>;

async function OngletTaches({ logicielId, readOnly }: { logicielId: number; readOnly: boolean }) {
  const [taches, types, users] = await Promise.all([
    listTachesDuLogiciel(logicielId),
    listTypesTaches(),
    prisma.user.findMany({
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      select: { id: true, prenom: true, nom: true, email: true },
    }),
  ]);
  const aujourdhui = dateCalendaire(new Date());
  const fmtDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });
  const fmtInstant = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeZone: "Europe/Paris",
  });
  const nomDe = (u: { prenom: string; nom: string; email: string }) =>
    `${u.prenom} ${u.nom}`.trim() || u.email;
  return (
    <TachesPanel
      logicielId={logicielId}
      readOnly={readOnly}
      types={types.map((t) => ({ id: t.id, label: t.label }))}
      users={users.map((u) => ({ id: u.id, label: nomDe(u) }))}
      taches={taches.map((t) => ({
        id: t.id,
        titre: t.titre,
        description: t.description,
        typeTacheId: t.typeTacheId === null ? "" : String(t.typeTacheId),
        typeTacheLabel: t.typeTache?.label ?? null,
        periodicite: t.periodicite,
        moisPersonnalises: t.moisPersonnalises === null ? "" : String(t.moisPersonnalises),
        prochaineEcheance: dateStr(t.prochaineEcheance),
        statut: t.statut,
        assigneUserId: t.assigneUserId ?? "",
        assigneLabel: t.assigne ? nomDe(t.assigne) : t.assigneLibre,
        assigneLibre: t.assigneLibre,
        rappelJoursAvant: t.rappelJoursAvant === null ? "" : String(t.rappelJoursAvant),
        echeanceBadge: (
          <EcheanceBadge echeance={t.prochaineEcheance} aujourdhui={aujourdhui} statut={t.statut} />
        ),
        executions: t.executions.map((ex) => ({
          id: ex.id,
          faitLe: fmtInstant.format(ex.faitLe),
          echeancePrevue: fmtDate.format(ex.echeancePrevue),
          par: ex.faitParLabel,
          commentaire: ex.commentaire,
        })),
      }))}
    />
  );
}

async function OngletContrats({
  logiciel,
  readOnly,
}: {
  logiciel: LogicielComplet;
  readOnly: boolean;
}) {
  // Les catégories servent aux pièces jointes déposées sous une ligne de
  // contrat (décision municipale, contrat signé…) ; les éditeurs servent à
  // désigner le fournisseur, souvent l'éditeur mais parfois un revendeur.
  // `listMarchesPourRattachement` tient le filtrage : les marchés orphelins et
  // ceux du même éditeur, moins ceux que cette fiche couvre déjà. D'où l'id du
  // logiciel ET celui de son éditeur — aucun tri à refaire ici.
  const [categories, editeurs, seuils, marchesDisponibles] = await Promise.all([
    listCategoriesDocuments(),
    listEditeurs(),
    seuilsRappel(),
    listMarchesPourRattachement(logiciel.id, logiciel.editeurId),
  ]);
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  const jour = dateCalendaire(new Date());
  // Borne haute du « à renouveler » : le MÊME délai que les rappels par e-mail
  // et le tableau de bord (Administration › Messagerie). La pastille et le mail
  // apparaissent donc ensemble ; la figer à 90 les aurait laissés diverger.
  const limiteRenouvellement = dateStr(new Date(jour.getTime() + seuils.contrat * 86_400_000));
  return (
    <ContratsPanel
      logicielId={logiciel.id}
      nbUtilisateurs={logiciel.nbUtilisateurs}
      nbMaxUtilisateurs={logiciel.nbMaxUtilisateurs}
      readOnly={readOnly}
      categories={categories.map((c) => ({ id: c.id, label: c.label }))}
      editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
      editeurDuLogicielId={logiciel.editeur?.id ?? null}
      marchesDisponibles={marchesDisponibles}
      // Calculé ICI et non dans le composant client : le jour courant lu des
      // deux côtés donnerait deux valeurs à cheval sur minuit, et React
      // signalerait une divergence d'hydratation.
      aujourdhui={dateStr(jour)}
      limiteRenouvellement={limiteRenouvellement}
      contrats={logiciel.contrats.map(
        (c): ContratRow => ({
          id: c.id,
          nature: c.nature ?? "",
          libelle: c.libelle,
          fournisseurId: c.fournisseurId === null ? "" : String(c.fournisseurId),
          fournisseurNom: c.fournisseur?.nom ?? null,
          referenceMarche: c.referenceMarche,
          referenceFournisseur: c.referenceFournisseur,
          montantAnnuel: c.montantAnnuel === null ? "" : String(c.montantAnnuel),
          montantTotal: c.montantTotal === null ? "" : String(c.montantTotal),
          montantMaxi: c.montantMaxi === null ? "" : String(c.montantMaxi),
          dateDebut: dateStr(c.dateDebut),
          dateFin: dateStr(c.dateFin),
          dureeAnnees: c.dureeAnnees === null ? "" : String(c.dureeAnnees),
          renouvellements: c.renouvellements === null ? "" : String(c.renouvellements),
          notes: c.notes,
          pieces: c.pieces.map((l) => {
            // Une seule pièce par ligne : on ne remonte que la première, même
            // si un dépôt direct par l'API en avait laissé plusieurs.
            const doc = l.documents[0];
            return {
              id: l.id,
              datePiece: dateStr(l.datePiece),
              document: doc
                ? {
                    id: doc.id,
                    nomOriginal: doc.nomOriginal,
                    categorieId: doc.categorieId,
                    categorie: doc.categorie?.label ?? null,
                    taille: doc.taille,
                    deposeParLabel: doc.deposeParLabel,
                    createdAt: fmt.format(doc.createdAt),
                  }
                : null,
            };
          }),
        }),
      )}
    />
  );
}

async function OngletDevis({
  logiciel,
  readOnly,
}: {
  logiciel: LogicielComplet;
  readOnly: boolean;
}) {
  // L'annuaire sert à désigner qui a remis le devis ; la catégorie « Devis »
  // est posée d'office sur les pièces déposées depuis cet onglet.
  const [categories, editeurs] = await Promise.all([listCategoriesDocuments(), listEditeurs()]);
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  return (
    <DevisPanel
      logicielId={logiciel.id}
      readOnly={readOnly}
      categories={categories.map((c) => ({ id: c.id, label: c.label }))}
      editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
      consultations={logiciel.consultations.map(
        (c): ConsultationRow => ({
          id: c.id,
          objet: c.objet,
          date: dateStr(c.date),
          devis: c.devis.map((d) => {
            // Un seul fichier par devis : on ne remonte que le premier, même si
            // un dépôt direct par l'API en avait laissé plusieurs.
            const doc = d.documents[0];
            return {
              id: d.id,
              fournisseurId: d.fournisseurId === null ? "" : String(d.fournisseurId),
              fournisseurNom: d.fournisseur?.nom ?? null,
              montant: d.montant === null ? "" : String(d.montant),
              date: dateStr(d.date),
              retenu: d.retenu,
              document: doc
                ? {
                    id: doc.id,
                    nomOriginal: doc.nomOriginal,
                    categorieId: doc.categorieId,
                    categorie: doc.categorie?.label ?? null,
                    taille: doc.taille,
                    deposeParLabel: doc.deposeParLabel,
                    createdAt: fmt.format(doc.createdAt),
                  }
                : null,
            };
          }),
        }),
      )}
    />
  );
}

async function OngletDocuments({
  logiciel,
  readOnly,
}: {
  logiciel: LogicielComplet;
  readOnly: boolean;
}) {
  const categories = await listCategoriesDocuments();
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  return (
    <DocumentsPanel
      parent={{ logicielId: logiciel.id }}
      readOnly={readOnly}
      categories={categories.map((c) => ({ id: c.id, label: c.label }))}
      documents={logiciel.documents.map((d) => ({
        id: d.id,
        nomOriginal: d.nomOriginal,
        categorieId: d.categorieId,
        categorie: d.categorie?.label ?? null,
        taille: d.taille,
        deposeParLabel: d.deposeParLabel,
        createdAt: fmt.format(d.createdAt),
      }))}
    />
  );
}

async function OngletSynthese({
  logiciel,
  readOnly,
}: {
  logiciel: LogicielComplet;
  readOnly: boolean;
}) {
  const [editeurs, technologies, criticites, statuts, hebergements] = await Promise.all([
    listEditeurs(),
    listTechnologies(),
    listCriticites(),
    listStatutsLogiciels(),
    listModesHebergement(),
  ]);
  return (
    <FicheForm
      id={logiciel.id}
      readOnly={readOnly}
      editeurs={editeurs.map((e) => ({ id: e.id, label: e.nom }))}
      technologies={technologies.map((t) => ({ id: t.id, label: t.label }))}
      criticites={criticites.map((c) => ({ id: c.id, label: c.label }))}
      statuts={statuts.map((s) => ({ cle: s.cle, label: s.label }))}
      hebergements={hebergements.map((h) => ({ cle: h.cle, label: h.label }))}
      nbPiecesJointes={compterPieces(logiciel)}
      values={{
        nom: logiciel.nom,
        description: logiciel.description,
        editeurId: logiciel.editeurId === null ? "" : String(logiciel.editeurId),
        developpementInterne: logiciel.developpementInterne,
        technologieId: logiciel.technologieId === null ? "" : String(logiciel.technologieId),
        criticiteId: logiciel.criticiteId === null ? "" : String(logiciel.criticiteId),
        hebergement: logiciel.hebergement,
        typeSource: logiciel.typeSource,
        statut: logiciel.statut,
        versionInstallee: logiciel.versionInstallee,
        url: logiciel.url,
        dateMiseEnService: dateStr(logiciel.dateMiseEnService),
        // null (non renseigné) → "" : c'est l'option vide de la liste.
        authentification: logiciel.authentification ?? "",
        authentificationForte: logiciel.authentificationForte,
        nbUtilisateurs: logiciel.nbUtilisateurs === null ? "" : String(logiciel.nbUtilisateurs),
        nbMaxUtilisateurs:
          logiciel.nbMaxUtilisateurs === null ? "" : String(logiciel.nbMaxUtilisateurs),
        referentMetier: logiciel.referentMetier,
        referentTechnique: logiciel.referentTechnique,
      }}
    />
  );
}

async function OngletLiaisons({
  logiciel,
  readOnly,
  supprimer,
}: {
  logiciel: LogicielComplet;
  readOnly: boolean;
  supprimer?: ReactNode;
}) {
  const [services, serveurs, autres] = await Promise.all([
    listServicesUtilisateurs(),
    listServeurs(),
    listAutresLogiciels(logiciel.id),
  ]);
  return (
    <LiaisonsPanel
      logicielId={logiciel.id}
      readOnly={readOnly}
      supprimer={supprimer}
      services={services.map((s) => ({ id: s.id, label: s.nom }))}
      servicesLies={logiciel.services.map((s) => s.serviceId)}
      serveurs={serveurs.map((s) => ({ id: s.id, label: s.nom }))}
      serveursLies={logiciel.serveurs.map((s) => ({
        serveurId: s.serveurId,
        nom: s.serveur.nom,
        environnement: s.environnement,
      }))}
      autresLogiciels={autres.map((l) => ({ id: l.id, label: l.nom }))}
      interconnexions={[
        ...logiciel.interconnexionsSource.map((ix) => ({
          id: ix.id,
          direction: "sortante" as const,
          autre: ix.cible,
          description: ix.description,
        })),
        ...logiciel.interconnexionsCible.map((ix) => ({
          id: ix.id,
          direction: "entrante" as const,
          autre: ix.source,
          description: ix.description,
        })),
      ]}
    />
  );
}
