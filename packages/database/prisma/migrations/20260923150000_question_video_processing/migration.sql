CREATE TYPE "VideoProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

CREATE TABLE "VideoProcessingJob" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "sourceAssetId" TEXT NOT NULL,
  "previousAssetId" TEXT,
  "status" "VideoProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAssetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoProcessingJob_status_nextAttemptAt_idx" ON "VideoProcessingJob"("status", "nextAttemptAt");
CREATE INDEX "VideoProcessingJob_questionId_createdAt_idx" ON "VideoProcessingJob"("questionId", "createdAt");
ALTER TABLE "VideoProcessingJob" ADD CONSTRAINT "VideoProcessingJob_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "VideoQuestionItem"("questionId") ON DELETE CASCADE ON UPDATE CASCADE;
