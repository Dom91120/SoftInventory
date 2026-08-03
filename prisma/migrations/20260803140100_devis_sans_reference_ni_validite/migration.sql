-- L'onglet Devis se resserre sur ce qui départage les offres : qui, combien,
-- quand, et la pièce jointe. La référence fournisseur et la date de fin de
-- validité ne sont plus ni affichées ni saisissables — les colonnes partent
-- avec (décision explicite : une référence saisie sur un devis est perdue).
ALTER TABLE "devis" DROP COLUMN "reference";
ALTER TABLE "devis" DROP COLUMN "valable_jusquau";
