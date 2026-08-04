-- L'échéance surveillée remonte de la pièce au marché : c'est « contrats
-- ».date_fin que le cron et le tableau de bord lisent désormais, avec son
-- marqueur anti-doublon.
ALTER TABLE "contrats" ADD COLUMN "rappel_envoye_le" DATE;
CREATE INDEX "contrats_date_fin_idx" ON "contrats"("date_fin");

-- RENAME et NON pas DROP + ADD, que Prisma aurait généré : la colonne garde
-- ses valeurs, qui deviennent des dates de pièce. L'index la suit.
ALTER TABLE "pieces_contrat" RENAME COLUMN "date_renouvellement" TO "date_piece";
ALTER INDEX "pieces_contrat_date_renouvellement_idx" RENAME TO "pieces_contrat_date_piece_idx";

-- Anti-doublon devenu sans objet : plus aucun rappel n'est accroché à la
-- pièce. La colonne ne portait qu'un marqueur de mécanisme (la date pour
-- laquelle un envoi avait déjà eu lieu), aucune donnée métier.
ALTER TABLE "pieces_contrat" DROP COLUMN "rappel_envoye_le";
