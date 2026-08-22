-- « Éditeur » et « Fournisseur » ne font plus qu'une catégorie, étiquetée
-- « Éditeur/Fournisseur » sur la clé `editeur` : ce qu'une société édite et ce
-- qu'elle fournit se lisent sur sa fiche, par ses logiciels, ses marchés et ses
-- devis. Les fiches en `fournisseur` rejoignent `editeur`, puis la valeur
-- disparaît du type — PostgreSQL ne retire pas une valeur d'enum, on le refait.
UPDATE "editeurs" SET "categorie" = 'editeur' WHERE "categorie" = 'fournisseur';
ALTER TYPE "CategorieEditeur" RENAME TO "CategorieEditeur_old";
CREATE TYPE "CategorieEditeur" AS ENUM ('editeur', 'autorite_certification');
ALTER TABLE "editeurs" ALTER COLUMN "categorie" DROP DEFAULT;
ALTER TABLE "editeurs" ALTER COLUMN "categorie" TYPE "CategorieEditeur" USING "categorie"::text::"CategorieEditeur";
ALTER TABLE "editeurs" ALTER COLUMN "categorie" SET DEFAULT 'editeur';
DROP TYPE "CategorieEditeur_old";
