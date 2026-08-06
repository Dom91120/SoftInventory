-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('lecteur', 'admin');

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
CREATE TYPE "TypeContrat" AS ENUM ('perpetuelle', 'abonnement', 'libre', 'autre');

-- CreateEnum
CREATE TYPE "Environnement" AS ENUM ('production', 'test', 'recette', 'formation');

-- CreateEnum
CREATE TYPE "Periodicite" AS ENUM ('mensuelle', 'trimestrielle', 'semestrielle', 'annuelle', 'personnalisee', 'ponctuelle');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('active', 'en_pause', 'terminee');

-- CreateTable
CREATE TABLE "statuts_logiciels" (
    "id" SERIAL NOT NULL,
    "cle" "CycleDeVie" NOT NULL,
    "label" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#94a3b8',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "statuts_logiciels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "prenom" TEXT NOT NULL DEFAULT '',
    "nom" TEXT NOT NULL DEFAULT '',
    "tel" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'lecteur',
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "ldap" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "last_request" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "email_hash" TEXT NOT NULL,
    "failures" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_failure_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("email_hash")
);

-- CreateTable
CREATE TABLE "throttle_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "throttle_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "editeurs" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL DEFAULT '',
    "code_postal" TEXT NOT NULL DEFAULT '',
    "ville" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "site_web" TEXT NOT NULL DEFAULT '',
    "support_url" TEXT NOT NULL DEFAULT '',
    "support_email" TEXT NOT NULL DEFAULT '',
    "support_telephone" TEXT NOT NULL DEFAULT '',
    "support_horaires" TEXT NOT NULL DEFAULT '',
    "commercial_contact" TEXT NOT NULL DEFAULT '',
    "commercial_telephone" TEXT NOT NULL DEFAULT '',
    "commercial_email" TEXT NOT NULL DEFAULT '',
    "admin_contact" TEXT NOT NULL DEFAULT '',
    "admin_telephone" TEXT NOT NULL DEFAULT '',
    "admin_email" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "editeurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services_utilisateurs" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "contact_nom" TEXT NOT NULL DEFAULT '',
    "contact_email" TEXT NOT NULL DEFAULT '',
    "contact_telephone" TEXT NOT NULL DEFAULT '',
    "position" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "services_utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serveurs" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "os" TEXT NOT NULL DEFAULT '',
    "localisation" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "serveurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technologies" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criticites" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "rank" SMALLINT NOT NULL DEFAULT 0,
    "couleur" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "criticites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_taches" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "types_taches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories_documents" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "categories_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logiciels" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "editeur_id" INTEGER,
    "developpement_interne" BOOLEAN NOT NULL DEFAULT false,
    "hebergement" "Hebergement" NOT NULL DEFAULT 'on_premise',
    "technologie_id" INTEGER,
    "criticite_id" INTEGER,
    "type_source" "TypeSource" NOT NULL DEFAULT 'proprietaire',
    "statut" "CycleDeVie" NOT NULL DEFAULT 'production',
    "version_installee" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "date_mise_en_service" DATE,
    "authentification" "ModeAuthentification" NOT NULL DEFAULT 'locale',
    "nb_utilisateurs" INTEGER,
    "nb_max_utilisateurs" INTEGER,
    "referent_metier" TEXT NOT NULL DEFAULT '',
    "referent_technique" TEXT NOT NULL DEFAULT '',
    "cout_annuel" DECIMAL(12,2),
    "fin_contrat_le" DATE,
    "rappel_envoye_le" DATE,
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
CREATE TABLE "contrats" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER NOT NULL,
    "fournisseur_id" INTEGER,
    "libelle" TEXT NOT NULL DEFAULT '',
    "reference_marche" TEXT NOT NULL DEFAULT '',
    "montant_annuel" DECIMAL(12,2),
    "montant_maxi" DECIMAL(12,2),
    "date_debut" DATE,
    "date_fin" DATE,
    "rappel_envoye_le" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_contrat" (
    "id" SERIAL NOT NULL,
    "contrat_id" INTEGER NOT NULL,
    "type" "TypeContrat" NOT NULL DEFAULT 'abonnement',
    "cout_annuel" DECIMAL(12,2),
    "date_piece" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "date" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" SERIAL NOT NULL,
    "consultation_id" INTEGER NOT NULL,
    "fournisseur_id" INTEGER,
    "montant" DECIMAL(12,2),
    "date" DATE,
    "retenu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taches_recurrentes" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER NOT NULL,
    "type_tache_id" INTEGER,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "periodicite" "Periodicite" NOT NULL DEFAULT 'annuelle',
    "mois_personnalises" SMALLINT,
    "prochaine_echeance" DATE NOT NULL,
    "statut" "StatutTache" NOT NULL DEFAULT 'active',
    "assigne_user_id" TEXT,
    "assigne_libre" TEXT NOT NULL DEFAULT '',
    "rappel_jours_avant" SMALLINT,
    "rappel_envoye_pour" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "taches_recurrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taches_executions" (
    "id" SERIAL NOT NULL,
    "tache_id" INTEGER NOT NULL,
    "echeance_prevue" DATE NOT NULL,
    "fait_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fait_par_id" TEXT,
    "fait_par_label" TEXT NOT NULL DEFAULT '',
    "commentaire" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "taches_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER,
    "editeur_id" INTEGER,
    "piece_contrat_id" INTEGER,
    "devis_id" INTEGER,
    "categorie_id" INTEGER,
    "nom_original" TEXT NOT NULL,
    "nom_stockage" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "depose_par_id" TEXT,
    "depose_par_label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "cfg_key" TEXT NOT NULL,
    "cfg_value" TEXT,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("cfg_key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_label" TEXT NOT NULL DEFAULT '',
    "actor_role" TEXT NOT NULL DEFAULT '',
    "target" TEXT,
    "details" JSONB,
    "ip" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_mails" (
    "id" SERIAL NOT NULL,
    "to_addr" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "attempts" SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_tried_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_mails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_templates" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "statuts_logiciels_cle_key" ON "statuts_logiciels"("cle");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "two_factor_secret_idx" ON "two_factor"("secret");

-- CreateIndex
CREATE INDEX "two_factor_user_id_idx" ON "two_factor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE INDEX "login_attempts_last_failure_at_idx" ON "login_attempts"("last_failure_at");

-- CreateIndex
CREATE INDEX "throttle_buckets_reset_at_idx" ON "throttle_buckets"("reset_at");

-- CreateIndex
CREATE UNIQUE INDEX "editeurs_nom_key" ON "editeurs"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "services_utilisateurs_nom_key" ON "services_utilisateurs"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "serveurs_nom_key" ON "serveurs"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_label_key" ON "technologies"("label");

-- CreateIndex
CREATE UNIQUE INDEX "criticites_label_key" ON "criticites"("label");

-- CreateIndex
CREATE UNIQUE INDEX "types_taches_label_key" ON "types_taches"("label");

-- CreateIndex
CREATE UNIQUE INDEX "categories_documents_label_key" ON "categories_documents"("label");

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
CREATE INDEX "contrats_logiciel_id_idx" ON "contrats"("logiciel_id");

-- CreateIndex
CREATE INDEX "contrats_fournisseur_id_idx" ON "contrats"("fournisseur_id");

-- CreateIndex
CREATE INDEX "contrats_date_fin_idx" ON "contrats"("date_fin");

-- CreateIndex
CREATE INDEX "pieces_contrat_contrat_id_idx" ON "pieces_contrat"("contrat_id");

-- CreateIndex
CREATE INDEX "pieces_contrat_date_piece_idx" ON "pieces_contrat"("date_piece");

-- CreateIndex
CREATE INDEX "consultations_logiciel_id_idx" ON "consultations"("logiciel_id");

-- CreateIndex
CREATE INDEX "devis_consultation_id_idx" ON "devis"("consultation_id");

-- CreateIndex
CREATE INDEX "devis_fournisseur_id_idx" ON "devis"("fournisseur_id");

-- CreateIndex
CREATE INDEX "taches_recurrentes_logiciel_id_idx" ON "taches_recurrentes"("logiciel_id");

-- CreateIndex
CREATE INDEX "taches_recurrentes_type_tache_id_idx" ON "taches_recurrentes"("type_tache_id");

-- CreateIndex
CREATE INDEX "taches_recurrentes_assigne_user_id_idx" ON "taches_recurrentes"("assigne_user_id");

-- CreateIndex
CREATE INDEX "taches_recurrentes_statut_prochaine_echeance_idx" ON "taches_recurrentes"("statut", "prochaine_echeance");

-- CreateIndex
CREATE INDEX "taches_executions_tache_id_idx" ON "taches_executions"("tache_id");

-- CreateIndex
CREATE INDEX "taches_executions_fait_le_idx" ON "taches_executions"("fait_le");

-- CreateIndex
CREATE UNIQUE INDEX "documents_nom_stockage_key" ON "documents"("nom_stockage");

-- CreateIndex
CREATE INDEX "documents_logiciel_id_idx" ON "documents"("logiciel_id");

-- CreateIndex
CREATE INDEX "documents_editeur_id_idx" ON "documents"("editeur_id");

-- CreateIndex
CREATE INDEX "documents_piece_contrat_id_idx" ON "documents"("piece_contrat_id");

-- CreateIndex
CREATE INDEX "documents_devis_id_idx" ON "documents"("devis_id");

-- CreateIndex
CREATE INDEX "documents_categorie_id_idx" ON "documents"("categorie_id");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "failed_mails_createdAt_idx" ON "failed_mails"("createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "editeurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_contrat" ADD CONSTRAINT "pieces_contrat_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "editeurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_recurrentes" ADD CONSTRAINT "taches_recurrentes_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_recurrentes" ADD CONSTRAINT "taches_recurrentes_type_tache_id_fkey" FOREIGN KEY ("type_tache_id") REFERENCES "types_taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_recurrentes" ADD CONSTRAINT "taches_recurrentes_assigne_user_id_fkey" FOREIGN KEY ("assigne_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_executions" ADD CONSTRAINT "taches_executions_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "taches_recurrentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_editeur_id_fkey" FOREIGN KEY ("editeur_id") REFERENCES "editeurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_piece_contrat_id_fkey" FOREIGN KEY ("piece_contrat_id") REFERENCES "pieces_contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Exactement UN parent (logiciel, éditeur, pièce de marché ou devis) :
-- invariant que Prisma ne sait pas exprimer, appliqué par la base elle-même
-- (les services le vérifient aussi, mais une écriture directe en SQL ne doit
-- pas pouvoir le contourner). Ajouté à la main ici : `migrate diff` ne génère
-- que ce que le datamodel exprime, et perdrait donc cette contrainte.
ALTER TABLE "documents" ADD CONSTRAINT "documents_un_parent"
  CHECK (num_nonnulls("logiciel_id", "editeur_id", "piece_contrat_id", "devis_id") = 1);
