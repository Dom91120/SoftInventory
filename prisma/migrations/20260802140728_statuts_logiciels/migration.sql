-- CreateTable
CREATE TABLE "statuts_logiciels" (
    "id" SERIAL NOT NULL,
    "cle" "CycleDeVie" NOT NULL,
    "label" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#94a3b8',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "statuts_logiciels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "statuts_logiciels_cle_key" ON "statuts_logiciels"("cle");

-- Les quatre clés du cycle de vie, avec les libellés et les couleurs qui
-- étaient jusqu'ici figés dans le code (LIBELLES.statut et BADGE_STATUT).
-- Reprises dans la migration plutôt que dans un seed : la table doit être
-- complète dès la création, l'écran Référentiels n'autorisant pas l'ajout.
INSERT INTO "statuts_logiciels" ("cle", "label", "couleur", "position") VALUES
  ('evaluation',  'En évaluation', '#2563eb', 1),
  ('production',  'En production', '#059669', 2),
  ('fin_de_vie',  'Fin de vie',    '#d97706', 3),
  ('abandonne',   'Abandonné',     '#94a3b8', 4);
