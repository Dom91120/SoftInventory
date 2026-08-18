-- « Expiré » quitte la liste des statuts : il SE DÉDUIT de la date de fin de
-- validité. En faire un choix ouvrait deux façons de dire la même chose, qui
-- pouvaient se contredire — une fiche « expirée » dont le terme court encore,
-- ou l'inverse. Les écrans le calculent désormais (voir `pastilleValidite`).
--
-- Les fiches qui le portaient repassent à « valide » : la date décidera. Aucune
-- ne le portait au moment de la migration.
UPDATE "certificats" SET "statut" = 'valide' WHERE "statut" = 'expire';

-- PostgreSQL ne sait pas retirer une valeur d'un enum : on passe par un type
-- intermédiaire, comme pour le remplacement précédent.
CREATE TYPE "StatutCertificat_new" AS ENUM ('valide', 'revoque', 'suspendu');

ALTER TABLE "certificats" ALTER COLUMN "statut" DROP DEFAULT;

ALTER TABLE "certificats"
  ALTER COLUMN "statut" TYPE "StatutCertificat_new"
  USING ("statut"::text)::"StatutCertificat_new";

DROP TYPE "StatutCertificat";
ALTER TYPE "StatutCertificat_new" RENAME TO "StatutCertificat";

ALTER TABLE "certificats" ALTER COLUMN "statut" SET DEFAULT 'valide';
