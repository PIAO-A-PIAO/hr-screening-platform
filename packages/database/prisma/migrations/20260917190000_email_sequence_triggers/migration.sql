CREATE TYPE "EmailSequenceTrigger" AS ENUM ('INVITATION', 'NO_RESPONSE', 'INTERVIEW_COMPLETED');

ALTER TABLE "EmailSequenceStep"
ADD COLUMN "trigger" "EmailSequenceTrigger" NOT NULL DEFAULT 'NO_RESPONSE';

UPDATE "EmailSequenceStep"
SET "trigger" = 'INVITATION'
WHERE "order" = 1;

CREATE INDEX "EmailSequenceStep_sequenceId_trigger_idx"
ON "EmailSequenceStep"("sequenceId", "trigger");

INSERT INTO "EmailTemplate" (
  "id", "key", "name", "subject", "html", "text", "createdAt", "updatedAt"
) VALUES (
  'email_template_completion_default',
  'completion_default',
  'Interview completion confirmation',
  'Your Digital Shovel interview is complete',
  '<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>Interview complete</h2><p>Hi {{firstName}},</p><p>Thank you for completing your interview for {{position.title}}. Your responses were submitted successfully.</p><p>Digital Shovel HR</p></div>',
  'Hi {{firstName}},\n\nThank you for completing your interview for {{position.title}}. Your responses were submitted successfully.\n\nDigital Shovel HR',
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "EmailSequenceStep" (
  "id", "sequenceId", "templateId", "delayValue", "delayUnit", "order", "trigger", "stopCondition", "createdAt", "updatedAt"
)
SELECT
  'completion_step_' || md5(sequence."id"),
  sequence."id",
  template."id",
  0,
  'MINUTES'::"EmailDelayUnit",
  COALESCE(MAX(step."order"), 0) + 1,
  'INTERVIEW_COMPLETED'::"EmailSequenceTrigger",
  NULL,
  NOW(),
  NOW()
FROM "EmailSequence" sequence
CROSS JOIN "EmailTemplate" template
LEFT JOIN "EmailSequenceStep" step ON step."sequenceId" = sequence."id"
WHERE template."key" = 'completion_default'
  AND NOT EXISTS (
    SELECT 1
    FROM "EmailSequenceStep" existing
    WHERE existing."sequenceId" = sequence."id"
      AND existing."trigger" = 'INTERVIEW_COMPLETED'::"EmailSequenceTrigger"
  )
GROUP BY sequence."id", template."id";
