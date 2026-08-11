-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "certificat_id" INTEGER;

-- CreateIndex
CREATE INDEX "documents_certificat_id_idx" ON "documents"("certificat_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_certificat_id_fkey" FOREIGN KEY ("certificat_id") REFERENCES "certificats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un document a EXACTEMENT UN parent : l'invariant s'élargit au certificat.
-- Ajouté à la main, comme dans 0_init : `migrate diff` ne génère que ce que le
-- datamodel exprime, et laisserait la contrainte sur ses quatre colonnes
-- d'origine — tout dépôt sur un certificat serait alors refusé par la base.
ALTER TABLE "documents" DROP CONSTRAINT "documents_un_parent";
ALTER TABLE "documents" ADD CONSTRAINT "documents_un_parent"
  CHECK (num_nonnulls("logiciel_id", "editeur_id", "piece_contrat_id", "devis_id", "certificat_id") = 1);
