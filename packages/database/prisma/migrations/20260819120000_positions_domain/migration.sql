CREATE TYPE "PositionStatus" AS ENUM ('DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED');

CREATE TABLE "Position" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "department" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "status" "PositionStatus" NOT NULL DEFAULT 'DRAFT',
  "owner" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Test"
  ADD COLUMN "positionId" TEXT;

CREATE UNIQUE INDEX "Test_positionId_key" ON "Test"("positionId");

ALTER TABLE "Test"
  ADD CONSTRAINT "Test_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "Position"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
