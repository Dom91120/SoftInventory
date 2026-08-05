-- Fusion des notes dans le descriptif : la fiche logiciel n'a plus qu'un champ
-- libre. L'UPDATE PRÉCÈDE le DROP — l'inverse perdrait le contenu.
--
-- Séparateur « --- » entre les deux textes, sur sa propre ligne : le descriptif
-- garde sa phrase en tête (c'est elle qui part dans l'export CSV), les notes la
-- suivent sans se confondre avec elle. Descriptif vide = les notes prennent
-- toute la place, sans séparateur orphelin.
UPDATE "logiciels"
SET "description" = CASE
  WHEN "description" = '' THEN "notes"
  ELSE "description" || E'\n\n---\n' || "notes"
END
WHERE "notes" <> '';

-- AlterTable
ALTER TABLE "logiciels" DROP COLUMN "notes";
