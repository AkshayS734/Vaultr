-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "signature" TEXT;

-- CreateIndex
CREATE INDEX "Session_expiresAt_userId_idx" ON "Session"("expiresAt", "userId");
