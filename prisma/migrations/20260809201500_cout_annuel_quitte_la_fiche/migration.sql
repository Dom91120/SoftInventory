-- Le coût annuel quitte définitivement la fiche logiciel : le MARCHÉ rattaché
-- porte seul le montant. La migration précédente a reporté les dix cas sans
-- ambiguïté ; les quatorze restants — 54 737 € répartis sur des fiches à
-- plusieurs marchés ou sans marché — ont été relevés hors application et sont
-- à ressaisir sur les marchés après vérification, un par un.
--
-- Suppression décidée en connaissance de cause : le contenu de la colonne a
-- été inventorié avant. Sauvegarde préalable softinventory-20260809-1958.dump.
ALTER TABLE "logiciels" DROP COLUMN "cout_annuel";
