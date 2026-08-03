import type {
  CategorieDocumentInput,
  CriticiteInput,
  ServeurInput,
  ServiceUtilisateurInput,
  StatutLogicielInput,
  TechnologieInput,
  TypeTacheInput,
} from "@/schemas/referentiels";
import { prisma } from "@/server/db";

// Couche données des référentiels : fonctions fines, NON gardées — les gardes
// vivent dans les server actions (pattern culturesa : guard → parse → service).

// ── Services utilisateurs ──
export function listServicesUtilisateurs() {
  return prisma.serviceUtilisateur.findMany({ orderBy: [{ position: "asc" }, { nom: "asc" }] });
}
export function createServiceUtilisateur(data: ServiceUtilisateurInput) {
  return prisma.serviceUtilisateur.create({ data });
}
export function updateServiceUtilisateur(id: number, data: ServiceUtilisateurInput) {
  return prisma.serviceUtilisateur.update({ where: { id }, data });
}
export function deleteServiceUtilisateur(id: number) {
  return prisma.serviceUtilisateur.delete({ where: { id } });
}

// ── Serveurs ──
export function listServeurs() {
  return prisma.serveur.findMany({ orderBy: { nom: "asc" } });
}
export function createServeur(data: ServeurInput) {
  return prisma.serveur.create({ data });
}
export function updateServeur(id: number, data: ServeurInput) {
  return prisma.serveur.update({ where: { id }, data });
}
export function deleteServeur(id: number) {
  return prisma.serveur.delete({ where: { id } });
}

// ── Technologies ──
export function listTechnologies() {
  return prisma.technologie.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] });
}
export function createTechnologie(data: TechnologieInput) {
  return prisma.technologie.create({ data });
}
export function updateTechnologie(id: number, data: TechnologieInput) {
  return prisma.technologie.update({ where: { id }, data });
}
export function deleteTechnologie(id: number) {
  return prisma.technologie.delete({ where: { id } });
}

// ── Criticités ──
export function listCriticites() {
  return prisma.criticite.findMany({ orderBy: [{ rank: "asc" }, { label: "asc" }] });
}
export function createCriticite(data: CriticiteInput) {
  return prisma.criticite.create({ data });
}
export function updateCriticite(id: number, data: CriticiteInput) {
  return prisma.criticite.update({ where: { id }, data });
}
export function deleteCriticite(id: number) {
  return prisma.criticite.delete({ where: { id } });
}

// ── Types de tâches ──
export function listTypesTaches() {
  return prisma.typeTache.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] });
}
export function createTypeTache(data: TypeTacheInput) {
  return prisma.typeTache.create({ data });
}
export function updateTypeTache(id: number, data: TypeTacheInput) {
  return prisma.typeTache.update({ where: { id }, data });
}
export function deleteTypeTache(id: number) {
  return prisma.typeTache.delete({ where: { id } });
}

// ── Catégories de documents ──
export function listCategoriesDocuments() {
  return prisma.categorieDocument.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] });
}
export function createCategorieDocument(data: CategorieDocumentInput) {
  return prisma.categorieDocument.create({ data });
}
export function updateCategorieDocument(id: number, data: CategorieDocumentInput) {
  return prisma.categorieDocument.update({ where: { id }, data });
}
export function deleteCategorieDocument(id: number) {
  return prisma.categorieDocument.delete({ where: { id } });
}

// ── Statuts du cycle de vie ──
// Ni création ni suppression : les quatre clés sont figées par l'enum
// `CycleDeVie` et référencées par les 91 fiches. Seul l'habillage se modifie.

export function listStatutsLogiciels() {
  return prisma.statutLogiciel.findMany({ orderBy: { position: "asc" } });
}
export function updateStatutLogiciel(id: number, data: StatutLogicielInput) {
  return prisma.statutLogiciel.update({ where: { id }, data });
}
