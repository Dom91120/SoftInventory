-- CreateTable
CREATE TABLE "modes_hebergement" (
    "id" SERIAL NOT NULL,
    "cle" "Hebergement" NOT NULL,
    "label" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#94a3b8',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modes_hebergement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modes_hebergement_cle_key" ON "modes_hebergement"("cle");

-- Les trois lignes que l'enum impose : la table n'est qu'un habillage, elle ne
-- se remplit pas à l'usage. Libellés et couleurs repris tels quels de ce que le
-- code affichait jusqu'ici, pour que rien ne change à l'écran tant que
-- personne n'a rien administré.
INSERT INTO "modes_hebergement" ("cle", "label", "couleur", "position") VALUES
    ('saas',       'SaaS',       '#2563eb', 1),
    ('on_premise', 'On premise', '#4f46e5', 2),
    ('hybride',    'Hybride',    '#7c3aed', 3);
