-- CreateEnum
CREATE TYPE "Hebergement" AS ENUM ('saas', 'on_premise', 'hybride');

-- CreateEnum
CREATE TYPE "CycleDeVie" AS ENUM ('evaluation', 'production', 'fin_de_vie', 'abandonne');

-- CreateEnum
CREATE TYPE "TypeSource" AS ENUM ('opensource', 'proprietaire', 'mixte');

-- CreateEnum
CREATE TYPE "ModeAuthentification" AS ENUM ('locale', 'sso', 'ldap', 'mixte', 'aucune');

-- CreateEnum
CREATE TYPE "LocalisationDonnees" AS ENUM ('ue', 'hors_ue', 'mixte', 'inconnue');

-- CreateEnum
CREATE TYPE "TypeLicence" AS ENUM ('perpetuelle', 'abonnement', 'libre', 'autre');

-- CreateEnum
CREATE TYPE "Environnement" AS ENUM ('production', 'test', 'recette', 'formation');

-- CreateTable
CREATE TABLE "logiciels" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "editeur_id" INTEGER,
    "hebergement" "Hebergement" NOT NULL DEFAULT 'on_premise',
    "technologie_id" INTEGER,
    "criticite_id" INTEGER,
    "type_source" "TypeSource" NOT NULL DEFAULT 'proprietaire',
    "statut" "CycleDeVie" NOT NULL DEFAULT 'production',
    "version_installee" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "date_mise_en_service" DATE,
    "authentification" "ModeAuthentification" NOT NULL DEFAULT 'locale',
    "nb_utilisateurs" INTEGER NOT NULL DEFAULT 0,
    "referent_metier" TEXT NOT NULL DEFAULT '',
    "referent_technique" TEXT NOT NULL DEFAULT '',
    "cout_annuel" DECIMAL(12,2),
    "fin_contrat_le" DATE,
    "rappel_envoye_le" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "donnees_personnelles" BOOLEAN NOT NULL DEFAULT false,
    "categories_donnees" TEXT NOT NULL DEFAULT '',
    "registre_ref" TEXT NOT NULL DEFAULT '',
    "localisation_donnees" "LocalisationDonnees" NOT NULL DEFAULT 'inconnue',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "logiciels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logiciels_services" (
    "logiciel_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,

    CONSTRAINT "logiciels_services_pkey" PRIMARY KEY ("logiciel_id","service_id")
);

-- CreateTable
CREATE TABLE "logiciels_serveurs" (
    "logiciel_id" INTEGER NOT NULL,
    "serveur_id" INTEGER NOT NULL,
    "environnement" "Environnement" NOT NULL DEFAULT 'production',

    CONSTRAINT "logiciels_serveurs_pkey" PRIMARY KEY ("logiciel_id","serveur_id","environnement")
);

-- CreateTable
CREATE TABLE "interconnexions" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "cible_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "interconnexions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licences" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER NOT NULL,
    "type" "TypeLicence" NOT NULL DEFAULT 'abonnement',
    "libelle" TEXT NOT NULL DEFAULT '',
    "nb_max_utilisateurs" INTEGER,
    "cout_annuel" DECIMAL(12,2),
    "date_renouvellement" DATE,
    "rappel_envoye_le" DATE,
    "reference_marche" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logiciels_editeur_id_idx" ON "logiciels"("editeur_id");

-- CreateIndex
CREATE INDEX "logiciels_technologie_id_idx" ON "logiciels"("technologie_id");

-- CreateIndex
CREATE INDEX "logiciels_criticite_id_idx" ON "logiciels"("criticite_id");

-- CreateIndex
CREATE INDEX "logiciels_statut_idx" ON "logiciels"("statut");

-- CreateIndex
CREATE INDEX "logiciels_nom_idx" ON "logiciels"("nom");

-- CreateIndex
CREATE INDEX "logiciels_services_service_id_idx" ON "logiciels_services"("service_id");

-- CreateIndex
CREATE INDEX "logiciels_serveurs_serveur_id_idx" ON "logiciels_serveurs"("serveur_id");

-- CreateIndex
CREATE INDEX "interconnexions_cible_id_idx" ON "interconnexions"("cible_id");

-- CreateIndex
CREATE UNIQUE INDEX "interconnexions_source_id_cible_id_key" ON "interconnexions"("source_id", "cible_id");

-- CreateIndex
CREATE INDEX "licences_logiciel_id_idx" ON "licences"("logiciel_id");

-- CreateIndex
CREATE INDEX "licences_date_renouvellement_idx" ON "licences"("date_renouvellement");

-- AddForeignKey
ALTER TABLE "logiciels" ADD CONSTRAINT "logiciels_editeur_id_fkey" FOREIGN KEY ("editeur_id") REFERENCES "editeurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logiciels" ADD CONSTRAINT "logiciels_technologie_id_fkey" FOREIGN KEY ("technologie_id") REFERENCES "technologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logiciels" ADD CONSTRAINT "logiciels_criticite_id_fkey" FOREIGN KEY ("criticite_id") REFERENCES "criticites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logiciels_services" ADD CONSTRAINT "logiciels_services_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logiciels_services" ADD CONSTRAINT "logiciels_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services_utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logiciels_serveurs" ADD CONSTRAINT "logiciels_serveurs_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logiciels_serveurs" ADD CONSTRAINT "logiciels_serveurs_serveur_id_fkey" FOREIGN KEY ("serveur_id") REFERENCES "serveurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconnexions" ADD CONSTRAINT "interconnexions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconnexions" ADD CONSTRAINT "interconnexions_cible_id_fkey" FOREIGN KEY ("cible_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licences" ADD CONSTRAINT "licences_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
