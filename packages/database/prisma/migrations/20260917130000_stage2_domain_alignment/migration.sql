-- Stage 2 domain alignment.
--
-- The physical UserTestAssignment table and legacy foreign-key column names are
-- retained deliberately so existing production identifiers and dependent data
-- remain stable. Prisma maps those physical names to the canonical Interview,
-- interviewId and candidateId domain names.

-- Position supports tags and department relations before legacy columns are removed.
ALTER TABLE "Position" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

CREATE TABLE "_DepartmentToPosition" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_DepartmentToPosition_AB_unique" ON "_DepartmentToPosition"("A", "B");
CREATE INDEX "_DepartmentToPosition_B_index" ON "_DepartmentToPosition"("B");
ALTER TABLE "_DepartmentToPosition" ADD CONSTRAINT "_DepartmentToPosition_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DepartmentToPosition" ADD CONSTRAINT "_DepartmentToPosition_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_DepartmentToUser" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_DepartmentToUser_AB_unique" ON "_DepartmentToUser"("A", "B");
CREATE INDEX "_DepartmentToUser_B_index" ON "_DepartmentToUser"("B");
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Department" ("id", "name", "createdAt", "updatedAt")
SELECT 'dept_' || md5(lower(trim("department"))), min(trim("department")), NOW(), NOW()
FROM "Position"
WHERE trim("department") <> ''
GROUP BY lower(trim("department"))
ON CONFLICT DO NOTHING;

INSERT INTO "_DepartmentToPosition" ("A", "B")
SELECT d."id", p."id"
FROM "Position" p
JOIN "Department" d ON lower(d."name") = lower(trim(p."department"))
ON CONFLICT DO NOTHING;

UPDATE "Position" p
SET "tags" = t."tags"
FROM "Test" t
WHERE t."positionId" = p."id" AND cardinality(t."tags") > 0;

-- Candidate is distinct from recruiter/admin User. Existing candidate IDs are
-- retained so attempts, responses, invitation links and audit records remain stable.
CREATE TABLE "Candidate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

INSERT INTO "Candidate" ("id", "name", "email", "createdAt", "updatedAt")
SELECT DISTINCT u."id", u."name", u."email", u."createdAt", u."updatedAt"
FROM "User" u
WHERE u."role" = 'CANDIDATE'::"UserRole"
   OR EXISTS (SELECT 1 FROM "UserTestAssignment" i WHERE i."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "Attempt" a WHERE a."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "Response" r WHERE r."userId" = u."id")
ON CONFLICT ("id") DO NOTHING;

-- Every Interview must belong to a Position. Standalone legacy tests receive a
-- recoverable draft Position rather than losing their assignments.
INSERT INTO "Position" ("id", "title", "description", "tags", "status", "department", "location", "owner", "createdAt", "updatedAt")
SELECT
  'legacy_position_' || md5(t."id"),
  t."name",
  COALESCE(t."description", 'Migrated from a standalone legacy test.'),
  t."tags",
  'DRAFT'::"PositionStatus",
  'Unassigned',
  '',
  '',
  t."createdAt",
  t."updatedAt"
FROM "Test" t
WHERE t."positionId" IS NULL
  AND EXISTS (SELECT 1 FROM "UserTestAssignment" i WHERE i."testId" = t."id")
ON CONFLICT ("id") DO NOTHING;

UPDATE "Test" t
SET "positionId" = 'legacy_position_' || md5(t."id")
WHERE t."positionId" IS NULL
  AND EXISTS (SELECT 1 FROM "UserTestAssignment" i WHERE i."testId" = t."id");

CREATE TYPE "InterviewWorkflowStatus" AS ENUM ('INVITED', 'TO_EVALUATE', 'SHORTLISTED', 'DISCARDED');

ALTER TABLE "UserTestAssignment"
  ADD COLUMN "positionId" TEXT,
  ADD COLUMN "workflowStatus" "InterviewWorkflowStatus";

UPDATE "UserTestAssignment" i
SET "positionId" = t."positionId"
FROM "Test" t
WHERE t."id" = i."testId";

UPDATE "UserTestAssignment" i
SET "workflowStatus" = CASE
  WHEN i."candidateStage" IN ('DISCARDED', 'WITHDRAWN')
    OR 'DISCARDED' = ANY(i."status")
    THEN 'DISCARDED'::"InterviewWorkflowStatus"
  WHEN i."candidateStage" IN ('SHORTLISTED', 'HIRED')
    OR i."status" && ARRAY['SHORTLISTED', 'HIRED']::"UserTestStatus"[]
    THEN 'SHORTLISTED'::"InterviewWorkflowStatus"
  WHEN i."candidateStage" IN ('TO_BE_EVALUATED', 'STAGE_1', 'STAGE_2', 'STAGE_3')
    OR i."status" && ARRAY['TO_BE_EVALUATED', 'STAGE_1', 'STAGE_2', 'STAGE_3']::"UserTestStatus"[]
    OR EXISTS (SELECT 1 FROM "Attempt" a WHERE a."assignmentId" = i."id" AND a."status" = 'SUBMITTED'::"AttemptStatus")
    THEN 'TO_EVALUATE'::"InterviewWorkflowStatus"
  ELSE 'INVITED'::"InterviewWorkflowStatus"
END;

ALTER TABLE "UserTestAssignment"
  ALTER COLUMN "positionId" SET NOT NULL,
  ALTER COLUMN "workflowStatus" SET NOT NULL,
  ALTER COLUMN "workflowStatus" SET DEFAULT 'INVITED';

DROP INDEX "UserTestAssignment_userId_testId_key";
CREATE UNIQUE INDEX "UserTestAssignment_userId_positionId_key" ON "UserTestAssignment"("userId", "positionId");
CREATE INDEX "UserTestAssignment_positionId_workflowStatus_idx" ON "UserTestAssignment"("positionId", "workflowStatus");

ALTER TABLE "UserTestAssignment" DROP CONSTRAINT "UserTestAssignment_userId_fkey";
ALTER TABLE "UserTestAssignment" ADD CONSTRAINT "UserTestAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTestAssignment" ADD CONSTRAINT "UserTestAssignment_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_userId_fkey";
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Response" DROP CONSTRAINT "Response_userId_fkey";
ALTER TABLE "Response" ADD CONSTRAINT "Response_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert stage history to the canonical four-state workflow while keeping IDs.
ALTER TABLE "CandidateStageChange"
  ALTER COLUMN "fromStage" TYPE "InterviewWorkflowStatus" USING (
    CASE
      WHEN "fromStage" IN ('DISCARDED', 'WITHDRAWN') THEN 'DISCARDED'
      WHEN "fromStage" IN ('SHORTLISTED', 'HIRED') THEN 'SHORTLISTED'
      WHEN "fromStage" IN ('TO_BE_EVALUATED', 'STAGE_1', 'STAGE_2', 'STAGE_3') THEN 'TO_EVALUATE'
      ELSE 'INVITED'
    END::"InterviewWorkflowStatus"
  ),
  ALTER COLUMN "toStage" TYPE "InterviewWorkflowStatus" USING (
    CASE
      WHEN "toStage" IN ('DISCARDED', 'WITHDRAWN') THEN 'DISCARDED'
      WHEN "toStage" IN ('SHORTLISTED', 'HIRED') THEN 'SHORTLISTED'
      WHEN "toStage" IN ('TO_BE_EVALUATED', 'STAGE_1', 'STAGE_2', 'STAGE_3') THEN 'TO_EVALUATE'
      ELSE 'INVITED'
    END::"InterviewWorkflowStatus"
  );

ALTER TABLE "UserTestAssignment"
  DROP COLUMN "status",
  DROP COLUMN "candidateStage";

DROP TYPE "CandidateStage";

-- Candidate users have been copied and all candidate-owned foreign keys now
-- target Candidate. Recruiter/admin Users remain in the User table.
DELETE FROM "User" WHERE "role" = 'CANDIDATE'::"UserRole";

-- Position ON_HOLD is intentionally consolidated into DRAFT.
ALTER TYPE "PositionStatus" RENAME TO "PositionStatus_old";
CREATE TYPE "PositionStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
ALTER TABLE "Position" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Position" ALTER COLUMN "status" TYPE "PositionStatus" USING (
  CASE WHEN "status"::text = 'ON_HOLD' THEN 'DRAFT' ELSE "status"::text END::"PositionStatus"
);
ALTER TABLE "Position" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "PositionStatus_old";

-- Add the migrated fallback department after its Position rows exist.
INSERT INTO "Department" ("id", "name", "createdAt", "updatedAt")
SELECT 'dept_' || md5('unassigned'), 'Unassigned', NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "Position" WHERE "department" = 'Unassigned')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_DepartmentToPosition" ("A", "B")
SELECT d."id", p."id"
FROM "Position" p
JOIN "Department" d ON d."name" = 'Unassigned'
WHERE p."department" = 'Unassigned'
ON CONFLICT DO NOTHING;

ALTER TABLE "Position"
  DROP COLUMN "department",
  DROP COLUMN "location",
  DROP COLUMN "owner";
