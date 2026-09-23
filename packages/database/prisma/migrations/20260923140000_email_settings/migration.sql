CREATE TABLE "EmailSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "smtpHost" TEXT,
  "smtpPort" INTEGER NOT NULL DEFAULT 587,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
  "smtpUser" TEXT,
  "smtpPasswordEncrypted" TEXT,
  "emailFrom" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailSettings_singleton" CHECK ("id" = 1)
);
