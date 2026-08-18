-- Les statuts d'un certificat deviennent : valide, révoqué, expiré, suspendu.
--
-- « Actif » devient « valide » — même chose, dit dans les termes du métier.
-- « En renouvellement » disparaît : il décrivait une commande en cours, pas
-- l'état du certificat, qui reste valide jusqu'à son terme ; aucune fiche ne le
-- portait, et la mention du bon de commande dit déjà où en est la commande.
-- « Expiré » et « suspendu » sont nouveaux : le premier constate ce que la date
-- de fin annonce, le second dit qu'on a mis le certificat de côté sans le
-- révoquer — il redeviendra utilisable, son échéance compte donc toujours.
--
-- On passe par un type intermédiaire : PostgreSQL ne sait ni retirer une
-- valeur d'un enum, ni en renommer une qui est utilisée par une colonne.
CREATE TYPE "StatutCertificat_new" AS ENUM ('valide', 'revoque', 'expire', 'suspendu');

ALTER TABLE "certificats" ALTER COLUMN "statut" DROP DEFAULT;

ALTER TABLE "certificats"
  ALTER COLUMN "statut" TYPE "StatutCertificat_new"
  USING (
    CASE "statut"::text
      WHEN 'actif' THEN 'valide'
      WHEN 'en_renouvellement' THEN 'valide'
      ELSE "statut"::text
    END
  )::"StatutCertificat_new";

DROP TYPE "StatutCertificat";
ALTER TYPE "StatutCertificat_new" RENAME TO "StatutCertificat";

ALTER TABLE "certificats" ALTER COLUMN "statut" SET DEFAULT 'valide';
