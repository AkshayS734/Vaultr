-- CreateEnum
CREATE TYPE "SecretType" AS ENUM ('PASSWORD', 'API_KEY', 'ENV_VARS');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "secretType" "SecretType" NOT NULL DEFAULT 'PASSWORD';

-- CreateIndex
CREATE INDEX "Item_secretType_idx" ON "Item"("secretType");
