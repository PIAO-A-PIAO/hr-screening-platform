-- Replace the single shortlisted stage with three explicit phases.
-- Existing shortlisted candidates and audit entries begin in Phase 1.
ALTER TABLE "UserTestAssignment" ALTER COLUMN "workflowStatus" DROP DEFAULT;
ALTER TYPE "InterviewWorkflowStatus" RENAME TO "InterviewWorkflowStatus_old";
CREATE TYPE "InterviewWorkflowStatus" AS ENUM (
  'INVITED', 'TO_EVALUATE', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'DISCARDED'
);

ALTER TABLE "UserTestAssignment"
  ALTER COLUMN "workflowStatus" TYPE "InterviewWorkflowStatus" USING (
    CASE WHEN "workflowStatus"::text = 'SHORTLISTED' THEN 'PHASE_1'
      ELSE "workflowStatus"::text
    END::"InterviewWorkflowStatus"
  );

ALTER TABLE "CandidateStageChange"
  ALTER COLUMN "fromStage" TYPE "InterviewWorkflowStatus" USING (
    CASE WHEN "fromStage"::text = 'SHORTLISTED' THEN 'PHASE_1'
      ELSE "fromStage"::text
    END::"InterviewWorkflowStatus"
  ),
  ALTER COLUMN "toStage" TYPE "InterviewWorkflowStatus" USING (
    CASE WHEN "toStage"::text = 'SHORTLISTED' THEN 'PHASE_1'
      ELSE "toStage"::text
    END::"InterviewWorkflowStatus"
  );

ALTER TABLE "UserTestAssignment" ALTER COLUMN "workflowStatus" SET DEFAULT 'INVITED';
DROP TYPE "InterviewWorkflowStatus_old";
