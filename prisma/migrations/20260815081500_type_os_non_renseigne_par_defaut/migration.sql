-- Le type d'OS ne s'impose plus : vide = non renseigné.
ALTER TABLE "serveurs" ALTER COLUMN "type_os" DROP NOT NULL,
ALTER COLUMN "type_os" DROP DEFAULT;

-- Les « windows » en base n'ont jamais été saisis : c'est le défaut qu'avait
-- pris la colonne à sa création, dans la migration précédente. On les rend au
-- vide, faute de quoi tout le parc se déclarerait Windows sans que personne
-- l'ait dit.
UPDATE "serveurs" SET "type_os" = NULL;
