import { Injectable, Logger } from "@nestjs/common";
import { AttemptStatus, EmailDelayUnit, EmailSequenceStopCondition, EmailSequenceTrigger, InterviewWorkflowStatus, Prisma, PositionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import * as nodemailer from "nodemailer";
import { getEnvironment } from "../config/environment";

type TemplateVariables = Record<string, unknown>;
type EmailTaskStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

type EmailTemplateRecord = {
  id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssignmentTemplateStep = {
  id: string;
  order: number;
  delayValue: number;
  delayUnit: EmailDelayUnit;
  trigger: EmailSequenceTrigger;
  stopCondition: EmailSequenceStopCondition | null;
  template: EmailTemplateRecord;
};

type AssignmentTemplateContext = {
  assignment: {
    id: string;
    inviteToken: string | null;
    invitedAt: Date;
    workflowStatus: InterviewWorkflowStatus;
    attempt: { status: AttemptStatus } | null;
    user: {
      id: string;
      name: string;
      email: string;
    };
    test: {
      id: string;
      name: string;
      position: {
        id: string;
        title: string;
        status: PositionStatus;
        emails: {
          id: string;
          steps: AssignmentTemplateStep[];
        } | null;
      } | null;
    };
  };
};

type QueueInvitationEmailInput = {
  assignmentId: string;
};

type EmailTaskRecord = {
  id: string;
  assignmentId: string;
  templateId: string;
  sequenceStepOrder: number;
  dueAt: Date;
  to: string;
  subject: string;
  html: string;
  text: string | null;
  variables: Prisma.JsonValue;
  status: EmailTaskStatus;
  attemptCount: number;
  lastError: string | null;
  idempotencyKey: string;
  stopCondition: EmailSequenceStopCondition | null;
  sentAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SendTaskResult = {
  messageId: string | null;
  skipped: boolean;
};

function stringifyTemplateValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function resolveTemplateValue(variables: TemplateVariables, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, variables);
}

function splitName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function delayToMilliseconds(delayValue: number, delayUnit: EmailDelayUnit) {
  switch (delayUnit) {
    case EmailDelayUnit.MINUTES:
      return delayValue * 60_000;
    case EmailDelayUnit.HOURS:
      return delayValue * 60 * 60_000;
    case EmailDelayUnit.DAYS:
      return delayValue * 24 * 60 * 60_000;
    default:
      return delayValue * 60_000;
  }
}

const EMAIL_QUEUE_NOTIFY_CHANNEL = "email_task_queue";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly environment = getEnvironment();

  private createTransporter() {
    return nodemailer.createTransport({
      host: this.environment.SMTP_HOST,
      port: this.environment.SMTP_PORT,
      secure: this.environment.SMTP_SECURE,
      auth: this.environment.SMTP_USER && this.environment.SMTP_PASSWORD
        ? {
            user: this.environment.SMTP_USER,
            pass: this.environment.SMTP_PASSWORD,
          }
        : undefined,
    });
  }

  private renderTemplate(template: string, variables: TemplateVariables) {
    return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
      return stringifyTemplateValue(resolveTemplateValue(variables, key));
    });
  }

  private buildInvitationUrl(testId: string, inviteToken: string) {
    const invitationUrl = new URL(`/tests/${encodeURIComponent(testId)}`, this.environment.WEB_ORIGIN);
    invitationUrl.searchParams.set("inviteToken", inviteToken);
    return invitationUrl.toString();
  }

  private buildTemplateVariables(context: AssignmentTemplateContext) {
    const { firstName, lastName } = splitName(context.assignment.user.name);

    return {
      firstName,
      lastName,
      candidate: {
        id: context.assignment.user.id,
        name: context.assignment.user.name,
        firstName,
        lastName,
        email: context.assignment.user.email,
      },
      assignment: {
        id: context.assignment.id,
        inviteToken: context.assignment.inviteToken,
        invitedAt: context.assignment.invitedAt.toISOString(),
      },
      test: {
        id: context.assignment.test.id,
        name: context.assignment.test.name,
      },
      position: context.assignment.test.position
        ? {
            id: context.assignment.test.position.id,
            title: context.assignment.test.position.title,
            status: context.assignment.test.position.status,
          }
        : null,
      inviteUrl: context.assignment.inviteToken
        ? this.buildInvitationUrl(context.assignment.test.id, context.assignment.inviteToken)
        : "",
    };
  }

  async loadAssignmentTemplateContext(
    tx: Prisma.TransactionClient,
    assignmentId: string,
  ): Promise<AssignmentTemplateContext> {
    const interview = await tx.interview.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        inviteToken: true,
        invitedAt: true,
        workflowStatus: true,
        attempt: { select: { status: true } },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        test: {
          select: {
            id: true,
            name: true,
            position: {
              select: {
                id: true,
                title: true,
                status: true,
                emails: {
                  select: {
                    id: true,
                    steps: {
                      orderBy: { order: "asc" },
                      select: {
                        id: true,
                        order: true,
                        delayValue: true,
                        delayUnit: true,
                        trigger: true,
                        stopCondition: true,
                        template: {
                          select: {
                            id: true,
                            key: true,
                            name: true,
                            subject: true,
                            html: true,
                            text: true,
                            createdAt: true,
                            updatedAt: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!interview) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    return {
      assignment: {
        ...interview,
        user: interview.candidate,
        invitedAt: asDate(interview.invitedAt),
        test: {
          ...interview.test,
          position: interview.test.position
            ? {
                ...interview.test.position,
                emails: interview.test.position.emails
                  ? {
                      ...interview.test.position.emails,
                      steps: interview.test.position.emails.steps.map((step) => ({
                        ...step,
                        template: {
                          ...step.template,
                          createdAt: asDate(step.template.createdAt),
                          updatedAt: asDate(step.template.updatedAt),
                        },
                      })),
                    }
                  : null,
              }
            : null,
        },
      },
    };
  }

  private async upsertTask(
    tx: Prisma.TransactionClient,
    input: {
      assignmentId: string;
      templateId: string;
      sequenceStepOrder: number;
      stopCondition: EmailSequenceStopCondition | null;
      dueAt: Date;
      to: string;
      subject: string;
      html: string;
      text: string | null;
      variables: TemplateVariables;
    },
  ): Promise<EmailTaskRecord> {
    const idempotencyKey = `${input.assignmentId}:${input.sequenceStepOrder}`;

    const [task] = await tx.$queryRaw<EmailTaskRecord[]>(Prisma.sql`
      INSERT INTO "EmailTask" (
        "id",
        "assignmentId",
        "templateId",
        "sequenceStepOrder",
        "dueAt",
        "to",
        "subject",
        "html",
        "text",
        "variables",
        "status",
        "attemptCount",
        "lastError",
        "idempotencyKey",
        "stopCondition",
        "sentAt",
        "processedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${input.assignmentId},
        ${input.templateId},
        ${input.sequenceStepOrder},
        ${input.dueAt},
        ${input.to},
        ${input.subject},
        ${input.html},
        ${input.text},
        ${input.variables},
        CAST('PENDING' AS "EmailTaskStatus"),
        0,
        NULL,
        ${idempotencyKey},
        CAST(${input.stopCondition} AS "EmailSequenceStopCondition"),
        NULL,
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT ("idempotencyKey") DO UPDATE SET
        "assignmentId" = EXCLUDED."assignmentId",
        "templateId" = EXCLUDED."templateId",
        "sequenceStepOrder" = EXCLUDED."sequenceStepOrder",
        "dueAt" = EXCLUDED."dueAt",
        "to" = EXCLUDED."to",
        "subject" = EXCLUDED."subject",
        "html" = EXCLUDED."html",
        "text" = EXCLUDED."text",
        "variables" = EXCLUDED."variables",
        "status" = CAST('PENDING' AS "EmailTaskStatus"),
        "attemptCount" = 0,
        "lastError" = NULL,
        "stopCondition" = EXCLUDED."stopCondition",
        "sentAt" = NULL,
        "processedAt" = NULL,
        "updatedAt" = NOW()
      RETURNING
        "id",
        "assignmentId",
        "templateId",
        "sequenceStepOrder",
        "dueAt",
        "to",
        "subject",
        "html",
        "text",
        "variables",
        "status",
        "attemptCount",
        "lastError",
        "idempotencyKey",
        "stopCondition",
        "sentAt",
        "processedAt",
        "createdAt",
        "updatedAt"
    `);

    return task;
  }

  private getStepByTrigger(context: AssignmentTemplateContext, trigger: EmailSequenceTrigger) {
    return context.assignment.test.position?.emails?.steps.find((step) => step.trigger === trigger) ?? null;
  }

  private logQueuedTask(task: EmailTaskRecord, label: string) {
    this.logger.log(
      `${label}: queued email task ${task.id} assignment=${task.assignmentId} step=${task.sequenceStepOrder} dueAt=${task.dueAt.toISOString()} to=${task.to}`,
    );
  }

  private async notifyWorker(tx: Prisma.TransactionClient, taskId: string, dueAt: Date) {
    if (dueAt.getTime() - Date.now() > 5_000) {
      return;
    }

    await tx.$executeRaw(Prisma.sql`
      SELECT pg_notify(${EMAIL_QUEUE_NOTIFY_CHANNEL}, ${taskId})
    `);
  }

  async queueInvitationEmail(
    tx: Prisma.TransactionClient,
    input: QueueInvitationEmailInput,
  ): Promise<EmailTaskRecord> {
    const context = await this.loadAssignmentTemplateContext(tx, input.assignmentId);
    const variables = this.buildTemplateVariables(context);
    const firstStep = this.getStepByTrigger(context, EmailSequenceTrigger.INVITATION);

    if (firstStep) {
      const task = await this.upsertTask(tx, {
        assignmentId: context.assignment.id,
        templateId: firstStep.template.id,
        sequenceStepOrder: firstStep.order,
        stopCondition: firstStep.stopCondition,
        dueAt: new Date(),
        to: context.assignment.user.email,
        subject: this.renderTemplate(firstStep.template.subject, variables),
        html: this.renderTemplate(firstStep.template.html, variables),
        text: firstStep.template.text ? this.renderTemplate(firstStep.template.text, variables) : null,
        variables,
      });
      this.logQueuedTask(task, "Invitation");
      await this.notifyWorker(tx, task.id, task.dueAt);
      return task;
    }

    // A saved sequence without an invitation rule intentionally disables that email.
    if (context.assignment.test.position?.emails) return null;

    const fallbackTemplate = await tx.emailTemplate.findUnique({
      where: { key: "invitation_default" },
    });

    if (!fallbackTemplate) {
      throw new Error("Email template not found: invitation_default");
    }

    const task = await this.upsertTask(tx, {
      assignmentId: context.assignment.id,
      templateId: fallbackTemplate.id,
      sequenceStepOrder: 1,
      stopCondition: null,
      dueAt: new Date(),
      to: context.assignment.user.email,
      subject: this.renderTemplate(fallbackTemplate.subject, variables),
      html: this.renderTemplate(fallbackTemplate.html, variables),
      text: fallbackTemplate.text ? this.renderTemplate(fallbackTemplate.text, variables) : null,
      variables,
    });
    this.logQueuedTask(task, "Invitation");
    await this.notifyWorker(tx, task.id, task.dueAt);
    return task;
  }

  async queueNextSequenceEmail(
    tx: Prisma.TransactionClient,
    input: {
      assignmentId: string;
      currentStepOrder: number;
      sentAt: Date;
    },
  ) {
    const context = await this.loadAssignmentTemplateContext(tx, input.assignmentId);
    const variables = this.buildTemplateVariables(context);
    const nextStep = context.assignment.test.position?.emails?.steps.find(
      (step) => step.trigger === EmailSequenceTrigger.NO_RESPONSE && step.order > input.currentStepOrder,
    ) ?? null;

    if (!nextStep) {
      return null;
    }

    const task = await this.upsertTask(tx, {
      assignmentId: context.assignment.id,
      templateId: nextStep.template.id,
      sequenceStepOrder: nextStep.order,
      stopCondition: nextStep.stopCondition,
      dueAt: new Date(input.sentAt.getTime() + delayToMilliseconds(nextStep.delayValue, nextStep.delayUnit)),
      to: context.assignment.user.email,
      subject: this.renderTemplate(nextStep.template.subject, variables),
      html: this.renderTemplate(nextStep.template.html, variables),
      text: nextStep.template.text ? this.renderTemplate(nextStep.template.text, variables) : null,
      variables,
    });
    this.logQueuedTask(task, "Sequence");
    await this.notifyWorker(tx, task.id, task.dueAt);
    return task;
  }

  async queueCompletionEmail(tx: Prisma.TransactionClient, input: { assignmentId: string }) {
    const context = await this.loadAssignmentTemplateContext(tx, input.assignmentId);
    const step = this.getStepByTrigger(context, EmailSequenceTrigger.INTERVIEW_COMPLETED);
    if (!step) return null;
    const variables = this.buildTemplateVariables(context);
    const task = await this.upsertTask(tx, {
      assignmentId: context.assignment.id,
      templateId: step.template.id,
      sequenceStepOrder: step.order,
      stopCondition: step.stopCondition,
      dueAt: new Date(Date.now() + delayToMilliseconds(step.delayValue, step.delayUnit)),
      to: context.assignment.user.email,
      subject: this.renderTemplate(step.template.subject, variables),
      html: this.renderTemplate(step.template.html, variables),
      text: step.template.text ? this.renderTemplate(step.template.text, variables) : null,
      variables,
    });
    this.logQueuedTask(task, "Completion");
    await this.notifyWorker(tx, task.id, task.dueAt);
    return task;
  }

  async sendTask(task: EmailTaskRecord): Promise<SendTaskResult> {
    if (!this.environment.EMAIL_ENABLED) {
      this.logger.log(`Email disabled. Would send task ${task.id} to ${task.to}`);
      return { messageId: null, skipped: true };
    }

    const transporter = this.createTransporter();
    const info = await transporter.sendMail({
      from: this.environment.EMAIL_FROM,
      to: task.to,
      subject: task.subject,
      html: task.html,
      text: task.text ?? undefined,
      headers: {
        "X-DS-HR-Idempotency-Key": task.idempotencyKey,
      },
    });

    this.logger.log(`Sent task ${task.id} to ${task.to}`);
    return {
      messageId: typeof info.messageId === "string" ? info.messageId : null,
      skipped: false,
    };
  }
}
