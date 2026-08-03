-- CreateEnum
CREATE TYPE "Periodicite" AS ENUM ('mensuelle', 'trimestrielle', 'semestrielle', 'annuelle', 'personnalisee', 'ponctuelle');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('active', 'en_pause', 'terminee');

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

-- AddForeignKey
ALTER TABLE "taches_recurrentes" ADD CONSTRAINT "taches_recurrentes_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_recurrentes" ADD CONSTRAINT "taches_recurrentes_type_tache_id_fkey" FOREIGN KEY ("type_tache_id") REFERENCES "types_taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_recurrentes" ADD CONSTRAINT "taches_recurrentes_assigne_user_id_fkey" FOREIGN KEY ("assigne_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_executions" ADD CONSTRAINT "taches_executions_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "taches_recurrentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
