-- AlterTable
ALTER TABLE "logiciels" ALTER COLUMN "nb_utilisateurs" DROP NOT NULL,
ALTER COLUMN "nb_utilisateurs" DROP DEFAULT;

-- Les 0 en place sont le DÉFAUT du modèle, pas un comptage : la colonne était
-- NOT NULL DEFAULT 0, et aucune des 91 fiches n'avait de valeur saisie
-- (vérifié avant la migration). On les bascule donc à NULL, seule façon de
-- distinguer désormais « personne ne s'en sert » de « pas encore compté ».
UPDATE "logiciels" SET "nb_utilisateurs" = NULL WHERE "nb_utilisateurs" = 0;
