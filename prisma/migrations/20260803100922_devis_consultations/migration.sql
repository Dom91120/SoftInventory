-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "devis_id" INTEGER;

-- CreateTable
CREATE TABLE "consultations" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "date" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" SERIAL NOT NULL,
    "consultation_id" INTEGER NOT NULL,
    "fournisseur_id" INTEGER,
    "montant" DECIMAL(12,2),
    "date" DATE,
    "reference" TEXT NOT NULL DEFAULT '',
    "valable_jusquau" DATE,
    "retenu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultations_logiciel_id_idx" ON "consultations"("logiciel_id");

-- CreateIndex
CREATE INDEX "devis_consultation_id_idx" ON "devis"("consultation_id");

-- CreateIndex
CREATE INDEX "devis_fournisseur_id_idx" ON "devis"("fournisseur_id");

-- CreateIndex
CREATE INDEX "documents_devis_id_idx" ON "documents"("devis_id");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "editeurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
