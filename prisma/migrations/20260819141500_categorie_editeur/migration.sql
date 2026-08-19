-- L'annuaire dit ce qu'est chaque société : éditeur, fournisseur ou autorité
-- de certification. Tout le monde démarre « editeur », à requalifier fiche
-- par fiche.
CREATE TYPE "CategorieEditeur" AS ENUM ('editeur', 'fournisseur', 'autorite_certification');
ALTER TABLE "editeurs" ADD COLUMN "categorie" "CategorieEditeur" NOT NULL DEFAULT 'editeur';
