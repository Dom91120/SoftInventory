-- « Contrat / marché » recouvrait deux natures distinctes. On les sépare.
--
-- La ligne existante devient « Contrat » plutôt que d'être supprimée : ses 63
-- documents gardent ainsi leur classement, à reventiler vers « Marché » au cas
-- par cas depuis l'écran. Les repartir automatiquement serait deviner.

-- Place laissée à « Marché », juste après « Contrat ».
UPDATE "categories_documents" SET "position" = "position" + 1 WHERE "position" >= 2;

UPDATE "categories_documents" SET "label" = 'Contrat' WHERE "label" = 'Contrat / marché';

INSERT INTO "categories_documents" ("label", "position")
VALUES ('Marché', 2)
ON CONFLICT ("label") DO NOTHING;
