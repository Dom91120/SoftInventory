-- Reprise unique : le fournisseur d'un marché n'avait jamais été saisi, alors
-- que l'information se déduit des logiciels qu'il couvre — c'est leur éditeur.
-- Migration plutôt que script : Postgres garantit qu'elle ne passe qu'une fois,
-- et le raisonnement reste lisible ici.
--
-- DEUX garde-fous, sans lesquels la reprise détruirait de l'information :
--
--  1. `fournisseur_id IS NULL` seulement. Les marchés déjà renseignés le sont
--     parce que le fournisseur N'EST PAS l'éditeur — un revendeur (Metsys pour
--     Semperis, Delta Industrie Service pour TX-Visio, IPOView pour LegalView).
--     Les écraser remplacerait le revendeur par l'éditeur.
--
--  2. UN SEUL éditeur distinct parmi les logiciels couverts. Un marché commun
--     qui couvrirait des logiciels de deux éditeurs n'a pas de fournisseur
--     déductible ; il reste vide et se saisira à la main.
--
-- Mesuré sur l'inventaire au moment de la reprise : 56 marchés remplis, 3
-- laissés en l'état, 0 ambigu, 0 sans éditeur.
UPDATE "contrats" c
SET "fournisseur_id" = s.editeur
FROM (
  SELECT cl."contrat_id" AS contrat, MIN(l."editeur_id") AS editeur
  FROM "contrats_logiciels" cl
  JOIN "logiciels" l ON l."id" = cl."logiciel_id"
  WHERE l."editeur_id" IS NOT NULL
  GROUP BY cl."contrat_id"
  HAVING COUNT(DISTINCT l."editeur_id") = 1
) s
WHERE c."id" = s.contrat
  AND c."fournisseur_id" IS NULL;
