CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'ABANDONED');
CREATE TYPE "AttemptScoreState" AS ENUM ('PENDING', 'PARTIAL', 'FINAL');

CREATE TABLE "Attempt" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "scoreSum" DOUBLE PRECISION,
  "scoreState" "AttemptScoreState" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attempt_assignmentId_key" ON "Attempt"("assignmentId");
CREATE UNIQUE INDEX "Attempt_userId_testId_key" ON "Attempt"("userId", "testId");
CREATE INDEX "Attempt_testId_idx" ON "Attempt"("testId");
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "UserTestAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Response"
  ADD CONSTRAINT "Response_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
