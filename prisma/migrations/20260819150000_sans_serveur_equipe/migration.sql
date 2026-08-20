-- Le « serveur équipé » quitte le certificat : aucune fiche ne l'utilisait
-- (0 sur 21), les certificats de machine se disent par l'usage (cachet).
ALTER TABLE "certificats" DROP CONSTRAINT "certificats_serveur_id_fkey";
DROP INDEX "certificats_serveur_id_idx";
ALTER TABLE "certificats" DROP COLUMN "serveur_id";
