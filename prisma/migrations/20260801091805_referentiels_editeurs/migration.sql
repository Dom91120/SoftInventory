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
