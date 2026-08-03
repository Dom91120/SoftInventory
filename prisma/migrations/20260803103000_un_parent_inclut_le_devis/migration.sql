-- « Un parent et un seul » : la contrainte ne comptait que logiciel_id,
-- editeur_id et contrat_id. Depuis que les pièces jointes peuvent pendre à un
-- DEVIS, elle rejetait tout dépôt de ce type (23514) — la base a d'ailleurs
-- bloqué le premier essai, comme prévu.
--
-- Refaite plutôt que modifiée : PostgreSQL ne sait pas altérer l'expression
-- d'un CHECK existant.
ALTER TABLE "documents" DROP CONSTRAINT "documents_un_parent";
ALTER TABLE "documents" ADD CONSTRAINT "documents_un_parent"
  CHECK (num_nonnulls("logiciel_id", "editeur_id", "contrat_id", "devis_id") = 1);
