-- Ce que l'acte fixe et que les dates ne disent pas : la durée ferme du marché
-- et le nombre de reconductions prévues. Deux colonnes nullables, purement
-- additives — les marchés déjà saisis restent « non renseigné » sur ces points,
-- ce qui est exact tant que personne n'a rouvert l'acte.
-- AlterTable
ALTER TABLE "contrats" ADD COLUMN "duree_annees" INTEGER;
ALTER TABLE "contrats" ADD COLUMN "renouvellements" INTEGER;
