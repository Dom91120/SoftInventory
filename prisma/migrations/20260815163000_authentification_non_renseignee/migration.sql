-- Le mode d'authentification ne s'impose plus : vide = non renseigné.
ALTER TABLE "logiciels" ALTER COLUMN "authentification" DROP NOT NULL,
ALTER COLUMN "authentification" DROP DEFAULT;

-- Les « locale » n'ont pas été saisis : c'est le défaut qu'a pris la colonne à
-- chaque création de fiche, et 84 logiciels sur 85 le portaient — l'écran
-- Statistiques écartait d'ailleurs ce champ pour cette raison. On les rend au
-- vide, ce qui reste (« ldap », « sso », « mixte », « aucune ») ayant, lui,
-- été choisi.
UPDATE "logiciels" SET "authentification" = NULL WHERE "authentification" = 'locale';
