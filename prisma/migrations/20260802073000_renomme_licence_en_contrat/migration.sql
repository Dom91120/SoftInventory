-- Renommage « licence » → « contrat » jusqu'en base, pour que le code parle le
-- même vocabulaire que l'écran (onglet Contrats).
--
-- Écrite À LA MAIN : `prisma migrate dev` ne sait pas reconnaître un renommage
-- et proposait un DROP + CREATE, qui aurait vidé la table. Les RENAME ci-dessous
-- préservent les 26 lignes existantes, et reprennent les noms d'index et de
-- contraintes attendus par la convention Prisma (`contrats_*`) pour que le
-- schéma et la base restent alignés.

ALTER TYPE "TypeLicence" RENAME TO "TypeContrat";

ALTER TABLE "licences" RENAME TO "contrats";
ALTER SEQUENCE "licences_id_seq" RENAME TO "contrats_id_seq";

ALTER TABLE "contrats" RENAME CONSTRAINT "licences_pkey" TO "contrats_pkey";
ALTER TABLE "contrats" RENAME CONSTRAINT "licences_logiciel_id_fkey" TO "contrats_logiciel_id_fkey";

ALTER INDEX "licences_logiciel_id_idx" RENAME TO "contrats_logiciel_id_idx";
ALTER INDEX "licences_date_renouvellement_idx" RENAME TO "contrats_date_renouvellement_idx";
