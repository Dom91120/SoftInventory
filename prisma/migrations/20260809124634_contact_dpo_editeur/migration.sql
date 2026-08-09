-- AlterTable
ALTER TABLE "editeurs" ADD COLUMN     "dpo_contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dpo_email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dpo_telephone" TEXT NOT NULL DEFAULT '';
