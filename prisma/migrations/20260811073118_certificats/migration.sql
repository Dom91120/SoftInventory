-- CreateEnum
CREATE TYPE "UsageCertificat" AS ENUM ('signature', 'authentification', 'cachet', 'autre');

-- CreateEnum
CREATE TYPE "SupportCertificat" AS ENUM ('carte', 'cle_usb', 'logiciel', 'autre');

-- CreateEnum
CREATE TYPE "StatutCertificat" AS ENUM ('actif', 'en_renouvellement', 'revoque');

-- CreateTable
CREATE TABLE "certificats" (
    "id" SERIAL NOT NULL,
    "fournisseur_id" INTEGER,
    "service_id" INTEGER,
    "serveur_id" INTEGER,
    "titulaire" TEXT NOT NULL,
    "fonction" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "usage" "UsageCertificat",
    "support" "SupportCertificat",
    "niveau" TEXT NOT NULL DEFAULT '',
    "numero_serie" TEXT NOT NULL DEFAULT '',
    "date_debut" DATE,
    "date_fin" DATE,
    "duree_annees" INTEGER,
    "montant_ttc" DECIMAL(12,2),
    "imputation" TEXT NOT NULL DEFAULT '',
    "bon_commande_le" DATE,
    "bon_commande_note" TEXT NOT NULL DEFAULT '',
    "code_revocation" TEXT NOT NULL DEFAULT '',
    "code_retrait" TEXT NOT NULL DEFAULT '',
    "statut" "StatutCertificat" NOT NULL DEFAULT 'actif',
    "rappel_envoye_le" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "certificats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certificats_fournisseur_id_idx" ON "certificats"("fournisseur_id");

-- CreateIndex
CREATE INDEX "certificats_service_id_idx" ON "certificats"("service_id");

-- CreateIndex
CREATE INDEX "certificats_serveur_id_idx" ON "certificats"("serveur_id");

-- CreateIndex
CREATE INDEX "certificats_date_fin_idx" ON "certificats"("date_fin");

-- AddForeignKey
ALTER TABLE "certificats" ADD CONSTRAINT "certificats_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "editeurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificats" ADD CONSTRAINT "certificats_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services_utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificats" ADD CONSTRAINT "certificats_serveur_id_fkey" FOREIGN KEY ("serveur_id") REFERENCES "serveurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
