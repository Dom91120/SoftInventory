-- Le marqueur « ce logiciel ne s'installe sur aucune machine du parc » : il
-- tourne chez l'éditeur (SaaS) ou sur les postes des agents. Sans lui, une
-- fiche sans serveur ne se distinguait pas d'une fiche dont le serveur reste à
-- saisir. Faux par défaut : c'est le cocher qui informe.
ALTER TABLE "logiciels" ADD COLUMN     "sans_serveur" BOOLEAN NOT NULL DEFAULT false;

-- L'environnement d'une installation quitte l'inventaire. Les trente lignes
-- de la table disaient TOUTES « production » : le champ n'a jamais servi, et
-- le retirer ne perd rien ni ne peut créer de doublon — la clé primaire passe
-- de (logiciel, serveur, environnement) à (logiciel, serveur), et deux lignes
-- ne peuvent fusionner que si elles étaient déjà identiques par ailleurs.
ALTER TABLE "logiciels_serveurs" DROP CONSTRAINT "logiciels_serveurs_pkey";
ALTER TABLE "logiciels_serveurs" DROP COLUMN "environnement";
ALTER TABLE "logiciels_serveurs" ADD CONSTRAINT "logiciels_serveurs_pkey" PRIMARY KEY ("logiciel_id", "serveur_id");

DROP TYPE "Environnement";
