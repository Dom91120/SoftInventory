-- CreateEnum
CREATE TYPE "TypeOs" AS ENUM ('windows', 'linux');

-- AlterTable
ALTER TABLE "serveurs" ADD COLUMN     "type_os" "TypeOs" NOT NULL DEFAULT 'windows',
ADD COLUMN     "virtuel" BOOLEAN NOT NULL DEFAULT true;
