CREATE TYPE "EmailDelayUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');
CREATE TYPE "EmailSequenceStopCondition" AS ENUM ('CANDIDATE_SUBMITTED', 'CANDIDATE_DISCARDED', 'POSITION_CLOSED');

CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "text" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

CREATE TABLE "EmailSequence" (
  "id" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSequenceStep" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "delayValue" INTEGER NOT NULL,
  "delayUnit" "EmailDelayUnit" NOT NULL,
  "order" INTEGER NOT NULL,
  "stopCondition" "EmailSequenceStopCondition",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSequence_positionId_key" ON "EmailSequence"("positionId");
CREATE UNIQUE INDEX "EmailSequenceStep_sequenceId_order_key" ON "EmailSequenceStep"("sequenceId", "order");
CREATE INDEX "EmailSequenceStep_sequenceId_idx" ON "EmailSequenceStep"("sequenceId");
CREATE INDEX "EmailSequenceStep_templateId_idx" ON "EmailSequenceStep"("templateId");

ALTER TABLE "EmailSequence"
  ADD CONSTRAINT "EmailSequence_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "Position"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailSequenceStep"
  ADD CONSTRAINT "EmailSequenceStep_sequenceId_fkey"
  FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailSequenceStep"
  ADD CONSTRAINT "EmailSequenceStep_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
