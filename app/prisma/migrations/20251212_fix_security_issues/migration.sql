-- DropIndex
DROP INDEX IF EXISTS "Session_expiresAt_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "authSalt";

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_refreshTokenHash_idx" ON "Session"("refreshTokenHash");
