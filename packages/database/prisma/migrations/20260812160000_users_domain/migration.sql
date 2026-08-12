CREATE TYPE "UserRole" AS ENUM ('RECRUITER', 'CANDIDATE');
CREATE TYPE "UserTestStatus" AS ENUM (
  'NOT_INVITED',
  'INVITED',
  'TO_BE_EVALUATED',
  'STAGE_1',
  'STAGE_2',
  'STAGE_3',
  'SHORTLISTED',
  'DISCARDED',
  'HIRED',
  'ON_HOLD'
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserTestStatus"[] NOT NULL DEFAULT ARRAY[]::"UserTestStatus"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserTestAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "status" "UserTestStatus"[] NOT NULL DEFAULT ARRAY[]::"UserTestStatus"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserTestAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTestAssignment_userId_testId_key" ON "UserTestAssignment"("userId", "testId");
CREATE INDEX "UserTestAssignment_testId_idx" ON "UserTestAssignment"("testId");
CREATE INDEX "UserTestAssignment_userId_idx" ON "UserTestAssignment"("userId");

ALTER TABLE "Test"
  ADD CONSTRAINT "Test_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserTestAssignment"
  ADD CONSTRAINT "UserTestAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTestAssignment"
  ADD CONSTRAINT "UserTestAssignment_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
