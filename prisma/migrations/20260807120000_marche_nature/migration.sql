-- Ce qu'est l'acte : un marché public, ou un contrat de gré à gré. La colonne
-- reste nullable et sans valeur par défaut — les 58 lignes déjà saisies n'ont
-- pas été dépouillées sur ce point, et leur attribuer « marché » d'office
-- inventerait une donnée que personne n'a lue.
-- CreateEnum
CREATE TYPE "NatureMarche" AS ENUM ('marche', 'contrat');

-- AlterTable
ALTER TABLE "contrats" ADD COLUMN "nature" "NatureMarche";
