-- Le plafond d'utilisateurs passe de la ligne de contrat au logiciel : c'est
-- lui que l'on compare à `logiciels.nb_utilisateurs` (badge « licences
-- dépassées » de la liste, de l'export CSV et du tableau de bord).

-- AlterTable
ALTER TABLE "logiciels" ADD COLUMN     "nb_max_utilisateurs" INTEGER;

-- Reprise des données AVANT la suppression de la colonne source : on somme les
-- plafonds des contrats du logiciel, en gardant la sémantique existante — un
-- seul contrat sans plafond (NULL = illimité) rend le total illimité, donc
-- NULL. Les logiciels sans contrat restent à NULL.
UPDATE "logiciels" l
SET "nb_max_utilisateurs" = t."total"
FROM (
  SELECT
    "logiciel_id",
    CASE
      WHEN bool_or("nb_max_utilisateurs" IS NULL) THEN NULL
      ELSE sum("nb_max_utilisateurs")
    END AS "total"
  FROM "licences"
  GROUP BY "logiciel_id"
) t
WHERE t."logiciel_id" = l."id";

-- AlterTable
ALTER TABLE "licences" DROP COLUMN "nb_max_utilisateurs";
