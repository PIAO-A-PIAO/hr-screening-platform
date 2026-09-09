CREATE TYPE "CandidateStage" AS ENUM (
  'NOT_INVITED', 'INVITED', 'IN_PROGRESS', 'TO_BE_EVALUATED',
  'STAGE_1', 'STAGE_2', 'STAGE_3', 'SHORTLISTED', 'ON_HOLD',
  'DISCARDED', 'HIRED', 'WITHDRAWN'
);
ALTER TABLE "UserTestAssignment"
  ADD COLUMN "candidateStage" "CandidateStage",
  ADD COLUMN "stageRevision" INTEGER NOT NULL DEFAULT 0;

-- Preserve existing application-specific review decisions; never use global User.status.
UPDATE "UserTestAssignment" SET "candidateStage" = CASE
  WHEN 'HIRED' = ANY("status") THEN 'HIRED'::"CandidateStage"
  WHEN 'DISCARDED' = ANY("status") THEN 'DISCARDED'::"CandidateStage"
  WHEN 'ON_HOLD' = ANY("status") THEN 'ON_HOLD'::"CandidateStage"
  WHEN 'SHORTLISTED' = ANY("status") THEN 'SHORTLISTED'::"CandidateStage"
  WHEN 'STAGE_3' = ANY("status") THEN 'STAGE_3'::"CandidateStage"
  WHEN 'STAGE_2' = ANY("status") THEN 'STAGE_2'::"CandidateStage"
  WHEN 'STAGE_1' = ANY("status") THEN 'STAGE_1'::"CandidateStage"
  ELSE NULL END;

CREATE TABLE "CandidateStageChange" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT,
  "positionId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "fromStage" "CandidateStage" NOT NULL,
  "toStage" "CandidateStage" NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateStageChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CandidateStageChange_assignmentId_changedAt_idx" ON "CandidateStageChange"("assignmentId", "changedAt");
CREATE INDEX "CandidateStageChange_positionId_changedAt_idx" ON "CandidateStageChange"("positionId", "changedAt");
ALTER TABLE "CandidateStageChange" ADD CONSTRAINT "CandidateStageChange_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "UserTestAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
