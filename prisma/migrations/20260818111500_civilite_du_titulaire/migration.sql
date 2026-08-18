-- La civilité quitte le champ « titulaire » pour une colonne à elle. Collée
-- devant le nom, elle rangeait « Mme AZZAZ » sous M avec les dix-sept autres,
-- et un tri par titulaire ne triait plus que sur deux valeurs.
--
-- NULLE par défaut, et nulle pour toujours sur un certificat de machine
-- (« SERVEUR CLIENT RGS ») : il n'y a personne à nommer, et lui inventer une
-- civilité serait pire que la laisser vide. L'extraction des civilités déjà
-- saisies est faite par `prisma/extraire-civilites.ts`, à part : une reprise de
-- données se relit et se rejoue, une migration de structure non.
CREATE TYPE "Civilite" AS ENUM ('m', 'mme');

ALTER TABLE "certificats" ADD COLUMN     "civilite" "Civilite";
