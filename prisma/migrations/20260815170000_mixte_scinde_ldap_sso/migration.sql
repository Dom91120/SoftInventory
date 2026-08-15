-- « mixte » se scinde en « mixte_ldap » et « mixte_sso » : c'est laquelle des
-- deux portes s'ajoute aux comptes locaux qui compte. Aucune fiche ne portait
-- l'ancienne valeur (le champ vient d'être rendu facultatif, et il était à
-- « locale » partout) ; la mise à NULL préalable garde néanmoins la conversion
-- sûre si une saisie était arrivée entre-temps.
UPDATE "logiciels" SET "authentification" = NULL WHERE "authentification" = 'mixte';

-- AlterEnum
BEGIN;
CREATE TYPE "ModeAuthentification_new" AS ENUM ('locale', 'sso', 'ldap', 'mixte_ldap', 'mixte_sso', 'aucune');
ALTER TABLE "logiciels" ALTER COLUMN "authentification" TYPE "ModeAuthentification_new" USING ("authentification"::text::"ModeAuthentification_new");
ALTER TYPE "ModeAuthentification" RENAME TO "ModeAuthentification_old";
ALTER TYPE "ModeAuthentification_new" RENAME TO "ModeAuthentification";
DROP TYPE "ModeAuthentification_old";
COMMIT;
