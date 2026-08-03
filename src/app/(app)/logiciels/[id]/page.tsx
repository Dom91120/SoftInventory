import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsPanel } from "@/components/documents-panel";
import { FlecheVoisin } from "@/components/fleche-voisin";
import { EcheanceBadge } from "@/components/tache-badges";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/client";
import { dateCalendaire } from "@/lib/taches-core";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";
import { listEditeurs } from "@/server/services/editeurs";
import { getLogiciel, listAutresLogiciels, voisinsLogiciel } from "@/server/services/logiciels";
import {
  listCategoriesDocuments,
  listCriticites,
  listServeurs,
  listServicesUtilisateurs,
  listStatutsLogiciels,
  listTechnologies,
  listTypesTaches,
} from "@/server/services/referentiels";
import { listTachesDuLogiciel } from "@/server/services/taches";
import { FicheForm } from "../fiche-form";
import { CriticiteBadge, LicencesBadge, StatutBadge } from "../shared";
import { type ContratRow, ContratsPanel } from "./contrats-panel";
import { type ConsultationRow, DevisPanel } from "./devis-panel";
import { LiaisonsPanel } from "./liaisons-panel";
import { RgpdPanel } from "./rgpd-panel";
import { SupportPanel } from "./support-panel";
import { TachesPanel } from "./taches-panel";

export const metadata: Metadata = { title: "Logiciel" };

const ONGLETS = [
  { key: "synthese", label: "Synthèse" },
  { key: "support", label: "Support" },
  { key: "liaisons", label: "Liaisons" },
  // La clé reste « contrats » : elle circule dans les liens des rappels
  // d'échéance déjà envoyés et dans les favoris. Seul le libellé change.
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
 * Anciennes valeurs de ?onglet= encore en circulation (rappels d'échéance déjà
 * envoyés, liens mis en favori) : sans cet alias elles retomberaient
 * silencieusement sur Synthèse.
 */
const ONGLETS_ALIAS: Record<string, OngletKey> = { licences: "contrats" };

/**
 * Applications faites par la DSI : le marqueur remplace l'ancien éditeur
 * sentinelle du même nom, et « Édité par… » n'aurait pas de sens ici.
 */
const LIBELLE_INTERNE = "Développement interne";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

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
  const demande = onglet === undefined ? undefined : (ONGLETS_ALIAS[onglet] ?? onglet);
  const actif: OngletKey = ONGLETS.some((o) => o.key === demande)
    ? (demande as OngletKey)
    : "synthese";

  const { precedent, suivant } = await voisinsLogiciel(id);

  return (
    <>
      {/* L'en-tête est encadré des flèches de navigation : on reste sur le
          MÊME onglet en changeant de logiciel, ce qui permet de parcourir
          l'inventaire onglet par onglet (les documents de l'un, puis de
          l'autre…). */}
      <div className="mb-6 flex items-start gap-2">
        <FlecheVoisin
          voisin={precedent}
          sens="precedent"
          hrefBase="/logiciels"
          query={`?onglet=${actif}`}
          entite="Logiciel"
        />
        <div className="min-w-0 flex-1">
          {/* Le titre et les indicateurs occupent la première rangée ; le
              sous-titre et le raccourci vers l'éditeur forment la seconde, d'où
              le sous-titre rendu ici plutôt que confié à PageHeader. C'est ce
              qui met « Fiche éditeur » À LA MÊME HAUTEUR que « Édité par… » :
              empilé dans les actions, il dépendait de la hauteur des badges et
              se décalait selon la présence du bouton « Ouvrir l'application ». */}
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
            actions={
              <span className="flex items-center gap-2">
                <StatutBadge statut={logiciel.statut} statuts={statuts} />
                <CriticiteBadge criticite={logiciel.criticite} />
                {/* Utilisation : seulement quand il y a un plafond à comparer,
                    sinon l'en-tête afficherait un « — » qui n'apprend rien. */}
                {logiciel.nbMaxUtilisateurs !== null ? (
                  <LicencesBadge
                    nbUtilisateurs={logiciel.nbUtilisateurs}
                    nbMaxUtilisateurs={logiciel.nbMaxUtilisateurs}
                  />
                ) : null}
              </span>
            }
          />
          {logiciel.developpementInterne || logiciel.editeur ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted">
                {logiciel.developpementInterne
                  ? LIBELLE_INTERNE
                  : `Édité par ${logiciel.editeur?.nom}`}
              </p>
              {/* Raccourci vers l'éditeur : c'est de là que viennent les
                  coordonnées de support de l'onglet dédié. Rien à y consulter
                  pour du développement interne — ni support, ni contrat. */}
              {logiciel.developpementInterne || !logiciel.editeur ? null : (
                <Link
                  href={`/editeurs/${logiciel.editeur.id}`}
                  className="text-sm font-medium text-muted hover:text-accent"
                >
                  Fiche éditeur
                </Link>
              )}
            </div>
          ) : null}
        </div>
        <FlecheVoisin
          voisin={suivant}
          sens="suivant"
          hrefBase="/logiciels"
          query={`?onglet=${actif}`}
          entite="Logiciel"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-line pb-px">
        {ONGLETS.map((o) => (
          <Link
            key={o.key}
            href={`/logiciels/${id}?onglet=${o.key}`}
            className={`rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition ${
              o.key === actif
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-strong"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {actif === "synthese" ? <OngletSynthese logiciel={logiciel} readOnly={!isAdmin} /> : null}
      {actif === "support" ? (
        <SupportPanel
          editeur={
            logiciel.editeur
              ? {
                  id: logiciel.editeur.id,
                  nom: logiciel.editeur.nom,
                  supportUrl: logiciel.editeur.supportUrl,
                  supportEmail: logiciel.editeur.supportEmail,
                  supportTelephone: logiciel.editeur.supportTelephone,
                  supportHoraires: logiciel.editeur.supportHoraires,
                }
              : null
          }
        />
      ) : null}
      {actif === "liaisons" ? <OngletLiaisons logiciel={logiciel} readOnly={!isAdmin} /> : null}
      {actif === "contrats" ? <OngletContrats logiciel={logiciel} readOnly={!isAdmin} /> : null}
      {actif === "devis" ? <OngletDevis logiciel={logiciel} readOnly={!isAdmin} /> : null}
      {actif === "taches" ? <OngletTaches logicielId={id} readOnly={!isAdmin} /> : null}
      {actif === "documents" ? <OngletDocuments logiciel={logiciel} readOnly={!isAdmin} /> : null}
      {actif === "rgpd" ? (
        <RgpdPanel
          logicielId={id}
          readOnly={!isAdmin}
          values={{
            donneesPersonnelles: logiciel.donneesPersonnelles,
            categoriesDonnees: logiciel.categoriesDonnees,
            registreRef: logiciel.registreRef,
            localisationDonnees: logiciel.localisationDonnees,
          }}
        />
      ) : null}
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
  const [categories, editeurs] = await Promise.all([listCategoriesDocuments(), listEditeurs()]);
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
  return (
    <ContratsPanel
      logicielId={logiciel.id}
      nbUtilisateurs={logiciel.nbUtilisateurs}
      nbMaxUtilisateurs={logiciel.nbMaxUtilisateurs}
      readOnly={readOnly}
      categories={categories.map((c) => ({ id: c.id, label: c.label }))}
      editeurs={editeurs.map((e) => ({ id: e.id, nom: e.nom }))}
      editeurDuLogiciel={logiciel.editeur?.nom ?? null}
      contrats={logiciel.contrats.map(
        (c): ContratRow => ({
          id: c.id,
          libelle: c.libelle,
          fournisseurId: c.fournisseurId === null ? "" : String(c.fournisseurId),
          fournisseurNom: c.fournisseur?.nom ?? null,
          referenceMarche: c.referenceMarche,
          notes: c.notes,
          pieces: c.pieces.map((l) => {
            // Une seule pièce par ligne : on ne remonte que la première, même
            // si un dépôt direct par l'API en avait laissé plusieurs.
            const doc = l.documents[0];
            return {
              id: l.id,
              type: l.type,
              coutAnnuel: l.coutAnnuel === null ? "" : String(l.coutAnnuel),
              dateRenouvellement: dateStr(l.dateRenouvellement),
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
  const [editeurs, technologies, criticites, statuts] = await Promise.all([
    listEditeurs(),
    listTechnologies(),
    listCriticites(),
    listStatutsLogiciels(),
  ]);
  return (
    <FicheForm
      id={logiciel.id}
      readOnly={readOnly}
      editeurs={editeurs.map((e) => ({ id: e.id, label: e.nom }))}
      technologies={technologies.map((t) => ({ id: t.id, label: t.label }))}
      criticites={criticites.map((c) => ({ id: c.id, label: c.label }))}
      statuts={statuts.map((s) => ({ cle: s.cle, label: s.label }))}
      // Les TROIS chemins de cascade vers `documents`, comme le compte
      // qu'applique compterPiecesLogiciel côté serveur.
      nbPiecesJointes={
        logiciel.documents.length +
        logiciel.contrats.reduce(
          (n, c) => n + c.pieces.reduce((m, l) => m + l.documents.length, 0),
          0,
        ) +
        logiciel.consultations.reduce(
          (n, c) => n + c.devis.reduce((m, d) => m + d.documents.length, 0),
          0,
        )
      }
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
        authentification: logiciel.authentification,
        nbUtilisateurs: logiciel.nbUtilisateurs === null ? "" : String(logiciel.nbUtilisateurs),
        nbMaxUtilisateurs:
          logiciel.nbMaxUtilisateurs === null ? "" : String(logiciel.nbMaxUtilisateurs),
        referentMetier: logiciel.referentMetier,
        referentTechnique: logiciel.referentTechnique,
        coutAnnuel: logiciel.coutAnnuel === null ? "" : String(logiciel.coutAnnuel),
        finContratLe: dateStr(logiciel.finContratLe),
        notes: logiciel.notes,
      }}
    />
  );
}

async function OngletLiaisons({
  logiciel,
  readOnly,
}: {
  logiciel: LogicielComplet;
  readOnly: boolean;
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
