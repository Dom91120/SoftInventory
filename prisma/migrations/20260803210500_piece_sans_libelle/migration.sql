-- Le libellé d'une pièce n'est plus ni affiché ni saisissable : ce qui la
-- distingue au sein d'un marché, c'est son fichier, son type et son montant.
-- La colonne part avec (vérifié avant migration : aucune des 114 pièces n'en
-- portait, la reprise du 3 août ne l'avait jamais renseignée).
ALTER TABLE "pieces_contrat" DROP COLUMN "libelle";
