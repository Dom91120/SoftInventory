-- Second facteur exigé à la connexion (2FA / MFA), à côté du mode
-- d'authentification. Faux par défaut : la double authentification est encore
-- l'exception, et c'est la cocher qui dit quelque chose.
ALTER TABLE "logiciels" ADD COLUMN     "authentification_forte" BOOLEAN NOT NULL DEFAULT false;
