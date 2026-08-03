-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "contrat_id" INTEGER;

-- CreateIndex
CREATE INDEX "documents_contrat_id_idx" ON "documents"("contrat_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
