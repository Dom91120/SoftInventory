-- Troisième chiffre du marché, à côté du montant annuel et du maximum annuel :
-- ce que l'acte engage sur sa durée entière. Purement additif, rien à reprendre.
-- AlterTable
ALTER TABLE "contrats" ADD COLUMN "montant_total" DECIMAL(12,2);
