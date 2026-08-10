CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Test" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "positionMetadata" JSONB,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
  "creatorId" TEXT,
  "creatorName" TEXT,
  "configuration" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
