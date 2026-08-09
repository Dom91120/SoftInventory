-- Les horaires saisis avant que la seconde ligne existe cousaient les deux
-- régimes sur une seule, chaque fiche avec sa ponctuation : « — » chez ANTS et
-- IPOView, « | » chez Ressources Consultants Finances. On les répartit sur les
-- deux champs pour que la liste et la fiche les empilent comme les suivantes.
--
-- `.*?` coupe à la PREMIÈRE occurrence du séparateur et `(.*)$` garde tout le
-- reste dans la seconde ligne : découper en champs aurait perdu ce qui suit une
-- deuxième occurrence. Une ligne sans séparateur, ou dont la seconde ligne est
-- déjà remplie, n'est pas touchée — la migration est sans effet si on la rejoue.
UPDATE "editeurs"
SET "support_horaires"   = btrim(regexp_replace("support_horaires", '^(.*?) [—|] (.*)$', '\1')),
    "support_horaires_2" = btrim(regexp_replace("support_horaires", '^(.*?) [—|] (.*)$', '\2'))
WHERE "support_horaires_2" = ''
  AND "support_horaires" ~ ' [—|] ';
