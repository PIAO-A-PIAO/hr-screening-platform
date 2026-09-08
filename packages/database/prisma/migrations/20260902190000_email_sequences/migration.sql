DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'EmailDelayUnit'
  ) THEN
    CREATE TYPE "EmailDelayUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'EmailSequenceStopCondition'
  ) THEN
    CREATE TYPE "EmailSequenceStopCondition" AS ENUM (
      'CANDIDATE_SUBMITTED',
      'CANDIDATE_DISCARDED',
      'POSITION_CLOSED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'EmailTaskStatus'
  ) THEN
    CREATE TYPE "EmailTaskStatus" AS ENUM (
      'PENDING',
      'PROCESSING',
      'SENT',
      'FAILED',
      'CANCELLED'
    );
  END IF;
END
$$;

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

CREATE TABLE "EmailTask" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "sequenceStepOrder" INTEGER NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "text" TEXT,
  "variables" JSONB NOT NULL,
  "status" "EmailTaskStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "stopCondition" "EmailSequenceStopCondition",
  "sentAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailTask_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");
CREATE UNIQUE INDEX "EmailTask_idempotencyKey_key" ON "EmailTask"("idempotencyKey");
CREATE INDEX "EmailTask_status_createdAt_idx" ON "EmailTask"("status", "createdAt");
CREATE INDEX "EmailTask_status_dueAt_idx" ON "EmailTask"("status", "dueAt");
CREATE INDEX "EmailTask_assignmentId_sequenceStepOrder_idx" ON "EmailTask"("assignmentId", "sequenceStepOrder");
CREATE INDEX "EmailTask_templateId_idx" ON "EmailTask"("templateId");
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

ALTER TABLE "EmailTask"
  ADD CONSTRAINT "EmailTask_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "UserTestAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailTask"
  ADD CONSTRAINT "EmailTask_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "EmailTemplate" ("id", "key", "name", "subject", "html", "text", "createdAt", "updatedAt") VALUES
  (
    'email_template_invitation_default',
    'invitation_default',
    'Invitation',
    'Digital Shovel interview invitation',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>Digital Shovel Interview Invitation</h2><p>Hi {{firstName}},</p><p>You have been invited to complete an interview with <strong>Digital Shovel</strong>.</p><p><a href="{{inviteUrl}}" style="display:inline-block;padding:12px 20px;background:#2457d6;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Start Interview</a></p><p>This invitation link is unique to you. Please do not share it.</p><p>Digital Shovel HR</p></div>',
    'Hi {{firstName}},\n\nYou have been invited to complete an interview with Digital Shovel.\n\nStart your interview:\n{{inviteUrl}}\n\nThis invitation link is unique to you. Please do not share it.\n\nDigital Shovel HR',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'email_template_reminder_default',
    'reminder_default',
    'Reminder',
    'Reminder: finish your Digital Shovel interview',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>Interview reminder</h2><p>Hi {{firstName}},</p><p>This is a reminder to complete your Digital Shovel interview.</p><p><a href="{{inviteUrl}}" style="display:inline-block;padding:12px 20px;background:#2457d6;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Continue Interview</a></p><p>Thank you,<br/>Digital Shovel HR</p></div>',
    'Hi {{firstName}},\n\nThis is a reminder to complete your Digital Shovel interview.\n\nContinue here:\n{{inviteUrl}}\n\nThank you,\nDigital Shovel HR',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'email_template_final_reminder_default',
    'final_reminder_default',
    'Final reminder',
    'Final reminder: your Digital Shovel interview is pending',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>Final reminder</h2><p>Hi {{firstName}},</p><p>Your interview is still pending. Please complete it as soon as possible.</p><p><a href="{{inviteUrl}}" style="display:inline-block;padding:12px 20px;background:#2457d6;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Open Interview</a></p><p>Digital Shovel HR</p></div>',
    'Hi {{firstName}},\n\nYour interview is still pending. Please complete it as soon as possible.\n\nOpen here:\n{{inviteUrl}}\n\nDigital Shovel HR',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
