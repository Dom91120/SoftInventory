-- Le marché devient une entité à part entière : il vit pour lui-même, avec sa
-- propre fiche, et couvre N logiciels au lieu d'appartenir à un seul.
--
-- Les rattachements existants sont REPRIS TELS QUELS : une ligne de `contrats`
-- = un marché, comme aujourd'hui. Les références portées par plusieurs
-- logiciels (UGAP sur 6 fiches, CT2406, CT2532, M20-19 sur 2) restent donc des
-- marchés distincts — les fusionner demanderait de choisir entre des montants
-- et des périodes qui diffèrent d'une ligne à l'autre, ce qu'aucun script ne
-- peut faire à notre place. Le regroupement se fera à la main, depuis la fiche.

-- CreateTable
CREATE TABLE "contrats_logiciels" (
    "contrat_id" INTEGER NOT NULL,
    "logiciel_id" INTEGER NOT NULL,

    CONSTRAINT "contrats_logiciels_pkey" PRIMARY KEY ("contrat_id","logiciel_id")
);

-- CreateIndex
CREATE INDEX "contrats_logiciels_logiciel_id_idx" ON "contrats_logiciels"("logiciel_id");

-- AddForeignKey
ALTER TABLE "contrats_logiciels" ADD CONSTRAINT "contrats_logiciels_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_logiciels" ADD CONSTRAINT "contrats_logiciels_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des rattachements AVANT la suppression de la colonne — l'inverse les
-- perdrait.
INSERT INTO "contrats_logiciels" ("contrat_id", "logiciel_id")
SELECT "id", "logiciel_id" FROM "contrats";

-- DropForeignKey / DropIndex / AlterTable
ALTER TABLE "contrats" DROP CONSTRAINT "contrats_logiciel_id_fkey";
DROP INDEX "contrats_logiciel_id_idx";
ALTER TABLE "contrats" DROP COLUMN "logiciel_id";
