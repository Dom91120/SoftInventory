-- Le coût annuel quittait la fiche logiciel : le MARCHÉ rattaché porte
-- désormais seul le montant. On reporte donc ce que la fiche savait et que le
-- marché ignorait, avant que la colonne ne disparaisse.
--
-- Uniquement les cas SANS AMBIGUÏTÉ, dix à ce jour :
--   - la fiche n'a qu'UN marché rattaché — à plusieurs, rien ne dit lequel
--     porte la dépense, et répartir au hasard fausserait deux totaux ;
--   - ce marché n'a PAS de montant annuel — il ferait autorité, la fiche n'est
--     qu'un reliquat ;
--   - et ce marché n'est la cible que de cette fiche-là, faute de quoi deux
--     montants s'écraseraient l'un l'autre selon l'ordre de passage.
--
-- Les quatorze autres — neuf fiches à plusieurs marchés, quatre sans aucun
-- marché, une dont le marché est déjà chiffré — gardent leur valeur et se
-- traitent à la main. La colonne `cout_annuel` ne sera supprimée qu'après.
UPDATE "contrats" c
SET "montant_annuel" = l."cout_annuel"
FROM "logiciels" l
WHERE l."cout_annuel" IS NOT NULL
  AND c."montant_annuel" IS NULL
  AND (SELECT count(*) FROM "contrats_logiciels" x WHERE x."logiciel_id" = l."id") = 1
  AND EXISTS (
    SELECT 1 FROM "contrats_logiciels" cl
    WHERE cl."logiciel_id" = l."id" AND cl."contrat_id" = c."id"
  )
  AND (
    SELECT count(*)
    FROM "contrats_logiciels" cl2
    JOIN "logiciels" l2 ON l2."id" = cl2."logiciel_id"
    WHERE cl2."contrat_id" = c."id"
      AND l2."cout_annuel" IS NOT NULL
      AND (SELECT count(*) FROM "contrats_logiciels" x2 WHERE x2."logiciel_id" = l2."id") = 1
  ) = 1;

-- `fin_contrat_le` est vide sur toutes les fiches : la colonne part sans rien
-- emporter. Son marqueur anti-doublon n'a plus d'objet et part avec elle.
ALTER TABLE "logiciels" DROP COLUMN "fin_contrat_le";
ALTER TABLE "logiciels" DROP COLUMN "rappel_envoye_le";
