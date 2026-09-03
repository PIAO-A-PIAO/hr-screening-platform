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
  )
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "subject" = EXCLUDED."subject",
  "html" = EXCLUDED."html",
  "text" = EXCLUDED."text",
  "updatedAt" = NOW();
