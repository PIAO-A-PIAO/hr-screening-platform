UPDATE "EmailTemplate"
SET
  "html" = CASE "key"
    WHEN 'invitation_default' THEN E'Hi {{candidate.firstName}},\n\nYou have been invited to complete an interview for {{position.title}}.\n\nStart your interview:\n{{inviteUrl}}\n\nThis invitation link is unique to you. Please do not share it.\n\nDigital Shovel HR'
    WHEN 'reminder_default' THEN E'Hi {{candidate.firstName}},\n\nThis is a reminder to complete your interview for {{position.title}}.\n\nContinue here:\n{{inviteUrl}}\n\nThank you,\nDigital Shovel HR'
    WHEN 'final_reminder_default' THEN E'Hi {{candidate.firstName}},\n\nYour interview for {{position.title}} is still pending. Please complete it as soon as possible.\n\nOpen your interview:\n{{inviteUrl}}\n\nDigital Shovel HR'
    WHEN 'completion_default' THEN E'Hi {{candidate.firstName}},\n\nThank you for completing your interview for {{position.title}}. Your responses were submitted successfully.\n\nDigital Shovel HR'
    ELSE "html"
  END,
  "text" = CASE "key"
    WHEN 'invitation_default' THEN E'Hi {{candidate.firstName}},\n\nYou have been invited to complete an interview for {{position.title}}.\n\nStart your interview:\n{{inviteUrl}}\n\nThis invitation link is unique to you. Please do not share it.\n\nDigital Shovel HR'
    WHEN 'reminder_default' THEN E'Hi {{candidate.firstName}},\n\nThis is a reminder to complete your interview for {{position.title}}.\n\nContinue here:\n{{inviteUrl}}\n\nThank you,\nDigital Shovel HR'
    WHEN 'final_reminder_default' THEN E'Hi {{candidate.firstName}},\n\nYour interview for {{position.title}} is still pending. Please complete it as soon as possible.\n\nOpen your interview:\n{{inviteUrl}}\n\nDigital Shovel HR'
    WHEN 'completion_default' THEN E'Hi {{candidate.firstName}},\n\nThank you for completing your interview for {{position.title}}. Your responses were submitted successfully.\n\nDigital Shovel HR'
    ELSE "text"
  END,
  "updatedAt" = NOW()
WHERE "key" IN ('invitation_default', 'reminder_default', 'final_reminder_default', 'completion_default');
