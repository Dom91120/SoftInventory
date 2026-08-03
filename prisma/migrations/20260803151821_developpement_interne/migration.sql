-- « Développement interne » n'était pas une société mais un éditeur sentinelle :
-- il apparaissait dans l'annuaire et dans toutes les listes de fournisseurs
-- (contrats, devis) alors qu'il n'a ni support, ni contrat, ni interlocuteur.
-- L'information passe sur le logiciel, où elle a toujours eu sa place.

-- AlterTable
ALTER TABLE "logiciels" ADD COLUMN     "developpement_interne" BOOLEAN NOT NULL DEFAULT false;

-- Reprise : les logiciels qui pointaient sur la sentinelle portent désormais le
-- marqueur. Rapprochement par LIBELLÉ — c'est le seul lien qui existait.
UPDATE "logiciels"
SET "developpement_interne" = true
WHERE "editeur_id" IN (SELECT "id" FROM "editeurs" WHERE "nom" = 'Développement interne');

-- Puis on détache, sinon la suppression de l'éditeur les mettrait à NULL par
-- effet de bord (SetNull) plutôt que par décision.
UPDATE "logiciels"
SET "editeur_id" = NULL
WHERE "editeur_id" IN (SELECT "id" FROM "editeurs" WHERE "nom" = 'Développement interne');

-- Enfin la fiche elle-même. Aucun document, contrat ni devis n'y pendait
-- (vérifié avant migration).
DELETE FROM "editeurs" WHERE "nom" = 'Développement interne';
