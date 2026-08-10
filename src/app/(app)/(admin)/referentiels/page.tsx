import type { Metadata } from "next";
import { Card, Onglets, PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import {
  listCategoriesDocuments,
  listCriticites,
  listModesHebergement,
  listServeurs,
  listServicesUtilisateurs,
  listStatutsLogiciels,
  listTechnologies,
  listTypesTaches,
} from "@/server/services/referentiels";
import { type RefColumn, RefTable } from "./ref-table";

export const metadata: Metadata = { title: "Référentiels" };

// Onglets pilotés par l'URL (?onglet=…) : rechargeables, partageables, sans état client.
const ONGLETS = [
  { key: "services", label: "Services utilisateurs" },
  { key: "serveurs", label: "Serveurs" },
  { key: "technologies", label: "Technologies" },
  { key: "criticites", label: "Criticités" },
  { key: "statuts", label: "Statuts" },
  { key: "hebergements", label: "Hébergements" },
  { key: "types-taches", label: "Types de tâches" },
  { key: "categories", label: "Catégories de documents" },
] as const;
type OngletKey = (typeof ONGLETS)[number]["key"];

/**
 * Référentiels à liste FIGÉE : on modifie l'habillage des lignes, jamais la
 * liste elle-même. Les quatre statuts du cycle de vie et les trois modes
 * d'hébergement sont portés par des enums et référencés par toutes les fiches ;
 * en supprimer un les laisserait orphelines. La garde réelle est côté serveur
 * (`fige` dans actions.ts), celle-ci ne fait que masquer les commandes.
 */
const FIGES = new Set<OngletKey>(["statuts", "hebergements"]);

const COLONNES: Record<OngletKey, RefColumn[]> = {
  services: [
    { key: "nom", label: "Nom du service" },
    { key: "contactNom", label: "Contact" },
    { key: "contactEmail", label: "E-mail" },
    { key: "contactTelephone", label: "Téléphone", width: "10rem" },
  ],
  serveurs: [
    { key: "nom", label: "Nom" },
    { key: "os", label: "Système" },
    { key: "localisation", label: "Localisation" },
    { key: "notes", label: "Notes" },
  ],
  technologies: [{ key: "label", label: "Libellé" }],
  criticites: [
    { key: "label", label: "Libellé" },
    { key: "rank", label: "Rang", type: "number", width: "6rem" },
    { key: "couleur", label: "Couleur", type: "color", width: "6rem" },
    { key: "description", label: "Description" },
  ],
  statuts: [
    { key: "label", label: "Libellé" },
    { key: "couleur", label: "Couleur", type: "color", width: "6rem" },
  ],
  hebergements: [
    { key: "label", label: "Libellé" },
    { key: "couleur", label: "Couleur", type: "color", width: "6rem" },
    { key: "position", label: "Ordre", type: "number", width: "6rem" },
  ],
  "types-taches": [{ key: "label", label: "Libellé" }],
  categories: [{ key: "label", label: "Libellé" }],
};

export default async function ReferentielsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  await requireRole("admin");
  const { onglet } = await searchParams;
  const actif: OngletKey = ONGLETS.some((o) => o.key === onglet)
    ? (onglet as OngletKey)
    : "services";

  // Petites tables : ne charger que celle de l'onglet actif.
  const rows =
    actif === "services"
      ? await listServicesUtilisateurs()
      : actif === "serveurs"
        ? await listServeurs()
        : actif === "technologies"
          ? await listTechnologies()
          : actif === "criticites"
            ? await listCriticites()
            : actif === "statuts"
              ? await listStatutsLogiciels()
              : actif === "hebergements"
                ? await listModesHebergement()
                : actif === "types-taches"
                  ? await listTypesTaches()
                  : await listCategoriesDocuments();

  const libelle = ONGLETS.find((o) => o.key === actif)?.label ?? "";

  return (
    <>
      <PageHeader
        title="Référentiels"
        subtitle="Les listes de valeurs de l'inventaire, extensibles sans redéploiement"
      />
      <Onglets onglets={ONGLETS} actif={actif} href={(key) => `/referentiels?onglet=${key}`} />
      <Card title={libelle}>
        <RefTable
          entity={actif}
          columns={COLONNES[actif]}
          rows={rows as ({ id: number } & Record<string, unknown>)[]}
          fige={FIGES.has(actif)}
          emptyLabel="Aucune valeur pour l'instant — ajoutez-en une avec la première ligne."
        />
      </Card>
    </>
  );
}
