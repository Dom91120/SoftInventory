-- L'écran parle de « pièce » d'un contrat ou marché ; le code disait « ligne ».
-- On aligne le schéma, pour qu'une lecture du modèle et une lecture de
-- l'application emploient le même mot.
--
-- Que des RENAME : aucune donnée ne bouge, aucune colonne n'est recréée.
-- (Le « fichier » attaché à une pièce reste, lui, un `document`.)

ALTER TABLE "lignes_contrat" RENAME TO "pieces_contrat";
ALTER TABLE "documents" RENAME COLUMN "ligne_contrat_id" TO "piece_contrat_id";

-- Contraintes et index gardent leur ancien libellé après un RENAME de table :
-- on les renomme à la main, sinon la prochaine migration Prisma les recréerait
-- en croyant à une divergence.
ALTER TABLE "pieces_contrat" RENAME CONSTRAINT "lignes_contrat_pkey" TO "pieces_contrat_pkey";
ALTER TABLE "pieces_contrat" RENAME CONSTRAINT "lignes_contrat_contrat_id_fkey" TO "pieces_contrat_contrat_id_fkey";
ALTER TABLE "documents" RENAME CONSTRAINT "documents_ligne_contrat_id_fkey" TO "documents_piece_contrat_id_fkey";

ALTER INDEX "lignes_contrat_contrat_id_idx" RENAME TO "pieces_contrat_contrat_id_idx";
ALTER INDEX "lignes_contrat_date_renouvellement_idx" RENAME TO "pieces_contrat_date_renouvellement_idx";
ALTER INDEX "documents_ligne_contrat_id_idx" RENAME TO "documents_piece_contrat_id_idx";

-- La contrainte CHECK « un parent et un seul » suit automatiquement le
-- renommage de colonne (PostgreSQL réécrit son expression) : rien à refaire.
