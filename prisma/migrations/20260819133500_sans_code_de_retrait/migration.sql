-- Le code de retrait quitte le certificat : aucune fiche n'en portait
-- (vérifié : 0 valeur sur 19), et il ne sert qu'à l'installation.
ALTER TABLE "certificats" DROP COLUMN "code_retrait";
