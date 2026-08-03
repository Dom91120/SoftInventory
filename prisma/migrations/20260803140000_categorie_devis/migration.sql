-- L'onglet Devis classe lui-même les pièces qu'il dépose : une seule catégorie
-- possible, « Devis ». Elle est posée ici plutôt que dans seed-init parce que
-- le code la cherche par libellé — sans cette ligne, les pièces déposées
-- depuis l'onglet arriveraient sans catégorie.
--
-- « Autre » repasse en dernier : c'est sa place dans une liste de choix.
UPDATE "categories_documents" SET "position" = 7 WHERE "label" = 'Autre';

INSERT INTO "categories_documents" ("label", "position")
VALUES ('Devis', 6)
ON CONFLICT ("label") DO NOTHING;
