-- AlterTable
ALTER TABLE "contrats" ADD COLUMN     "fournisseur_id" INTEGER;

-- CreateIndex
CREATE INDEX "contrats_fournisseur_id_idx" ON "contrats"("fournisseur_id");

-- AddForeignKey
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "editeurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
