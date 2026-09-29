ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT, ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "lastLoginAt" TIMESTAMP(3);
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE TABLE "AdminAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminAudit_subjectId_createdAt_idx" ON "AdminAudit"("subjectId", "createdAt");
CREATE INDEX "_DepartmentToPosition_B_A_idx" ON "_DepartmentToPosition"("B", "A");
