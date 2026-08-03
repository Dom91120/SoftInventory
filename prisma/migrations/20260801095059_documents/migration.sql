-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "logiciel_id" INTEGER,
    "editeur_id" INTEGER,
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

-- CreateIndex
CREATE UNIQUE INDEX "documents_nom_stockage_key" ON "documents"("nom_stockage");

-- CreateIndex
CREATE INDEX "documents_logiciel_id_idx" ON "documents"("logiciel_id");

-- CreateIndex
CREATE INDEX "documents_editeur_id_idx" ON "documents"("editeur_id");

-- CreateIndex
CREATE INDEX "documents_categorie_id_idx" ON "documents"("categorie_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_logiciel_id_fkey" FOREIGN KEY ("logiciel_id") REFERENCES "logiciels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_editeur_id_fkey" FOREIGN KEY ("editeur_id") REFERENCES "editeurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactement UN parent (logiciel OU éditeur) : invariant que Prisma ne sait pas
-- exprimer, appliqué par la base elle-même (le service le vérifie aussi, mais
-- une écriture directe en SQL ne doit pas pouvoir le contourner).
ALTER TABLE "documents" ADD CONSTRAINT "documents_un_parent"
  CHECK (num_nonnulls("logiciel_id", "editeur_id") = 1);
