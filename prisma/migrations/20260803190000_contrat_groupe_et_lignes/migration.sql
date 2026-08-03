-- Un contrat/marché regroupe désormais plusieurs LIGNES.
--
-- « contrats » ne garde que ce qui l'identifie (libellé, référence, société,
-- notes) ; le type, le montant, l'échéance et la pièce descendent sur la ligne,
-- car un même marché couvre souvent plusieurs postes aux termes distincts.
--
-- Reprise : chaque contrat existant devient un marché à UNE ligne par pièce
-- jointe (32 contrats en portaient plusieurs, jusqu'à 8). La PREMIÈRE ligne
-- reçoit le coût et l'échéance du contrat d'origine ; les suivantes n'ont que
-- leur pièce, à reventiler à la main. Un contrat sans pièce donne une ligne
-- unique. Rien n'est masqué, rien n'est perdu.

-- La contrainte « un parent et un seul » saute le temps du déménagement : les
-- documents porteront brièvement contrat_id ET ligne_contrat_id.
ALTER TABLE "documents" DROP CONSTRAINT "documents_un_parent";

-- CreateTable
CREATE TABLE "lignes_contrat" (
    "id" SERIAL NOT NULL,
    "contrat_id" INTEGER NOT NULL,
    "type" "TypeContrat" NOT NULL DEFAULT 'abonnement',
    "libelle" TEXT NOT NULL DEFAULT '',
    "cout_annuel" DECIMAL(12,2),
    "date_renouvellement" DATE,
    "rappel_envoye_le" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lignes_contrat_pkey" PRIMARY KEY ("id")
);

-- Colonne de travail : mémorise la pièce qui a fait naître la ligne, pour
-- rebrancher les documents juste après. Retirée en fin de migration.
ALTER TABLE "lignes_contrat" ADD COLUMN "doc_origine_id" INTEGER;

-- 1) Contrats SANS pièce : une ligne, qui reprend tout.
INSERT INTO "lignes_contrat" ("contrat_id", "type", "cout_annuel", "date_renouvellement", "rappel_envoye_le")
SELECT c."id", c."type", c."cout_annuel", c."date_renouvellement", c."rappel_envoye_le"
FROM "contrats" c
WHERE NOT EXISTS (SELECT 1 FROM "documents" d WHERE d."contrat_id" = c."id");

-- 2) Contrats AVEC pièces : une ligne par pièce. Seule la première (plus ancien
--    id) hérite du coût et de l'échéance — les répartir serait inventer.
INSERT INTO "lignes_contrat" ("contrat_id", "type", "cout_annuel", "date_renouvellement", "rappel_envoye_le", "doc_origine_id")
SELECT
  c."id",
  c."type",
  CASE WHEN t."rang" = 1 THEN c."cout_annuel" END,
  CASE WHEN t."rang" = 1 THEN c."date_renouvellement" END,
  CASE WHEN t."rang" = 1 THEN c."rappel_envoye_le" END,
  t."id"
FROM (
  SELECT d."id", d."contrat_id", ROW_NUMBER() OVER (PARTITION BY d."contrat_id" ORDER BY d."id") AS "rang"
  FROM "documents" d
  WHERE d."contrat_id" IS NOT NULL
) t
JOIN "contrats" c ON c."id" = t."contrat_id";

-- Les documents suivent la ligne née d'eux.
ALTER TABLE "documents" ADD COLUMN "ligne_contrat_id" INTEGER;

UPDATE "documents" d
SET "ligne_contrat_id" = l."id"
FROM "lignes_contrat" l
WHERE l."doc_origine_id" = d."id";

ALTER TABLE "lignes_contrat" DROP COLUMN "doc_origine_id";

-- L'ancien rattachement disparaît.
ALTER TABLE "documents" DROP CONSTRAINT "documents_contrat_id_fkey";
DROP INDEX "documents_contrat_id_idx";
ALTER TABLE "documents" DROP COLUMN "contrat_id";

-- Le marché ne porte plus ni montant, ni terme, ni nature.
DROP INDEX "contrats_date_renouvellement_idx";
ALTER TABLE "contrats" DROP COLUMN "type";
ALTER TABLE "contrats" DROP COLUMN "cout_annuel";
ALTER TABLE "contrats" DROP COLUMN "date_renouvellement";
ALTER TABLE "contrats" DROP COLUMN "rappel_envoye_le";

-- CreateIndex
CREATE INDEX "lignes_contrat_contrat_id_idx" ON "lignes_contrat"("contrat_id");
CREATE INDEX "lignes_contrat_date_renouvellement_idx" ON "lignes_contrat"("date_renouvellement");
CREATE INDEX "documents_ligne_contrat_id_idx" ON "documents"("ligne_contrat_id");

-- AddForeignKey
ALTER TABLE "lignes_contrat" ADD CONSTRAINT "lignes_contrat_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_ligne_contrat_id_fkey" FOREIGN KEY ("ligne_contrat_id") REFERENCES "lignes_contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Et la contrainte revient, avec la ligne à la place du contrat.
ALTER TABLE "documents" ADD CONSTRAINT "documents_un_parent"
  CHECK (num_nonnulls("logiciel_id", "editeur_id", "ligne_contrat_id", "devis_id") = 1);
