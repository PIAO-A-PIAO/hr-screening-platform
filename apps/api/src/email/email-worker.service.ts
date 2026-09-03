import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PositionStatus, UserTestStatus } from "@prisma/client";
import { Client, type Notification } from "pg";
import { PrismaService } from "../prisma/prisma.service";
import { getEnvironment } from "../config/environment";
import { EmailService } from "./email.service";

type EmailTaskStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

type ClaimedEmailTask = {
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
  stopCondition: "CANDIDATE_SUBMITTED" | "CANDIDATE_DISCARDED" | "POSITION_CLOSED" | null;
  sentAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const SUBMITTED_STATUSES = new Set<UserTestStatus>([
  UserTestStatus.TO_BE_EVALUATED,
  UserTestStatus.STAGE_1,
  UserTestStatus.STAGE_2,
  UserTestStatus.STAGE_3,
  UserTestStatus.SHORTLISTED,
  UserTestStatus.DISCARDED,
  UserTestStatus.HIRED,
  UserTestStatus.ON_HOLD,
]);

function isSubmitted(status: UserTestStatus[]) {
  return status.some((entry) => SUBMITTED_STATUSES.has(entry));
}

function isValidEmail(email: string) {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.includes("@");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const WORKER_WAKE_AHEAD_MS = 5_000;
const EMAIL_QUEUE_NOTIFY_CHANNEL = "email_task_queue";

type NextSleepWindow = {
  sleepMs: number;
  nextPendingDueAt: Date | null;
  oldestProcessingUpdatedAt: Date | null;
};

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorkerService.name);
  private readonly environment = getEnvironment();
  private stopped = false;
  private wakeResolver: (() => void) | null = null;
  private queueListener: Client | null = null;
  private lastSleepSummaryKey: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  stop() {
    this.stopped = true;
    this.wakeCurrentSleeper();
  }

  async onModuleInit() {
    await this.startQueueListener();
  }

  async onModuleDestroy() {
    this.stopped = true;
    this.wakeCurrentSleeper();
    await this.stopQueueListener();
  }

  async run() {
    this.logger.log(
      `Email worker started: batch=${this.environment.EMAIL_WORKER_BATCH_SIZE} maxAttempts=${this.environment.EMAIL_WORKER_MAX_ATTEMPTS} lockTimeout=${this.environment.EMAIL_WORKER_LOCK_TIMEOUT_MS}ms idlePoll=${this.environment.EMAIL_WORKER_POLL_INTERVAL_MS}ms`,
    );

    while (!this.stopped) {
      try {
        const processed = await this.runOnce();
        if (processed > 0) {
          this.logger.log(`Worker cycle processed ${processed} task(s)`);
          this.lastSleepSummaryKey = null;
        }

        if (this.stopped) {
          break;
        }

        const nextSleepWindow = await this.getNextSleepWindow();
        const sleepSummaryKey = nextSleepWindow.nextPendingDueAt
          ? `pending:${nextSleepWindow.nextPendingDueAt.toISOString()}:${nextSleepWindow.sleepMs}`
          : nextSleepWindow.oldestProcessingUpdatedAt
            ? `processing:${nextSleepWindow.oldestProcessingUpdatedAt.toISOString()}:${nextSleepWindow.sleepMs}`
            : `empty:${nextSleepWindow.sleepMs}`;

        if (nextSleepWindow.sleepMs > 0) {
          if (sleepSummaryKey !== this.lastSleepSummaryKey) {
            this.logger.log(
              nextSleepWindow.nextPendingDueAt
                ? `Sleeping ${nextSleepWindow.sleepMs}ms until next email task due at ${nextSleepWindow.nextPendingDueAt.toISOString()}`
                : nextSleepWindow.oldestProcessingUpdatedAt
                  ? `Sleeping ${nextSleepWindow.sleepMs}ms until stale processing task can be reclaimed`
                  : `Sleeping ${nextSleepWindow.sleepMs}ms until next queue check`,
            );
            this.lastSleepSummaryKey = sleepSummaryKey;
          }
          await this.sleepInterruptible(nextSleepWindow.sleepMs);
        }
      } catch (error) {
        this.logger.error(
          error instanceof Error ? error.stack ?? error.message : String(error),
        );
        await delay(this.environment.EMAIL_WORKER_POLL_INTERVAL_MS);
      }
    }
  }

  async runOnce() {
    const tasks = await this.claimDueTasks(this.environment.EMAIL_WORKER_BATCH_SIZE);
    for (const task of tasks) {
      await this.processTask(task);
    }

    return tasks.length;
  }

  private async sleepInterruptible(ms: number) {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const cleanup = () => {
        clearTimeout(timeout);
        if (this.wakeResolver === wakeResolver) {
          this.wakeResolver = null;
        }
      };

      const wakeResolver = () => {
        cleanup();
        resolve();
      };

      this.wakeResolver = wakeResolver;
    });
  }

  private wakeCurrentSleeper() {
    if (!this.wakeResolver) {
      return;
    }

    const wakeResolver = this.wakeResolver;
    this.wakeResolver = null;
    wakeResolver();
  }

  private async startQueueListener() {
    try {
      const client = new Client({
        connectionString: this.environment.DATABASE_URL,
      });

      client.on("notification", (message: Notification) => {
        if (message.channel !== EMAIL_QUEUE_NOTIFY_CHANNEL) {
          return;
        }
        this.wakeCurrentSleeper();
      });

      client.on("error", (error: unknown) => {
        this.logger.error(
          `Queue listener error: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.wakeCurrentSleeper();
      });

      await client.connect();
      await client.query(`LISTEN ${EMAIL_QUEUE_NOTIFY_CHANNEL}`);
      this.queueListener = client;
      this.logger.log(`Listening for queue notifications on ${EMAIL_QUEUE_NOTIFY_CHANNEL}`);
    } catch (error) {
      this.logger.error(
        `Failed to start queue listener: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.queueListener = null;
    }
  }

  private async stopQueueListener() {
    if (!this.queueListener) {
      return;
    }

    try {
      await this.queueListener.query(`UNLISTEN ${EMAIL_QUEUE_NOTIFY_CHANNEL}`);
    } catch (error) {
      this.logger.warn(
        `Failed to unlisten queue notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      await this.queueListener.end();
    } finally {
      this.queueListener = null;
    }
  }

  private async getNextSleepWindow(): Promise<NextSleepWindow> {
    const [window] = await this.prisma.$queryRaw<Array<{
      nextPendingDueAt: Date | null;
      oldestProcessingUpdatedAt: Date | null;
    }>>(Prisma.sql`
      SELECT
        (SELECT MIN("dueAt") FROM "EmailTask" WHERE "status" = 'PENDING') AS "nextPendingDueAt",
        (SELECT MIN("updatedAt") FROM "EmailTask" WHERE "status" = 'PROCESSING') AS "oldestProcessingUpdatedAt"
    `);

    const now = Date.now();
    const candidates: number[] = [];

    if (window?.nextPendingDueAt) {
      candidates.push(Math.max(0, window.nextPendingDueAt.getTime() - now - WORKER_WAKE_AHEAD_MS));
    }

    if (window?.oldestProcessingUpdatedAt) {
      candidates.push(
        Math.max(
          0,
          window.oldestProcessingUpdatedAt.getTime()
            + this.environment.EMAIL_WORKER_LOCK_TIMEOUT_MS
            - now
            - WORKER_WAKE_AHEAD_MS,
        ),
      );
    }

    if (candidates.length === 0) {
      if (this.lastSleepSummaryKey !== `empty:${this.environment.EMAIL_WORKER_POLL_INTERVAL_MS}`) {
        this.logger.log(`Queue is empty; using idle poll of ${this.environment.EMAIL_WORKER_POLL_INTERVAL_MS}ms`);
        this.lastSleepSummaryKey = `empty:${this.environment.EMAIL_WORKER_POLL_INTERVAL_MS}`;
      }
      return {
        sleepMs: this.environment.EMAIL_WORKER_POLL_INTERVAL_MS,
        nextPendingDueAt: null,
        oldestProcessingUpdatedAt: null,
      };
    }

    const sleepMs = Math.min(...candidates);
    return {
      sleepMs,
      nextPendingDueAt: window?.nextPendingDueAt ?? null,
      oldestProcessingUpdatedAt: window?.oldestProcessingUpdatedAt ?? null,
    };
  }

  private async claimDueTasks(limit: number): Promise<ClaimedEmailTask[]> {
    const staleBefore = new Date(Date.now() - this.environment.EMAIL_WORKER_LOCK_TIMEOUT_MS);

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<ClaimedEmailTask[]>(Prisma.sql`
        WITH claimed AS (
          SELECT "id"
          FROM "EmailTask"
          WHERE (
              "status" = 'PENDING'
              AND "dueAt" <= NOW()
            )
            OR (
              "status" = 'PROCESSING'
              AND "updatedAt" <= ${staleBefore}
            )
          ORDER BY "dueAt" ASC, "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "EmailTask" task
        SET "status" = 'PROCESSING',
            "attemptCount" = task."attemptCount" + 1,
            "updatedAt" = NOW(),
            "lastError" = NULL
        FROM claimed
        WHERE task."id" = claimed."id"
        RETURNING
          task."id",
          task."assignmentId",
          task."templateId",
          task."sequenceStepOrder",
          task."dueAt",
          task."to",
          task."subject",
          task."html",
          task."text",
          task."variables",
          task."status",
          task."attemptCount",
          task."lastError",
          task."idempotencyKey",
          task."stopCondition",
          task."sentAt",
          task."processedAt",
          task."createdAt",
          task."updatedAt"
      `);

      return claimed;
    });
  }

  private async markTask(
    taskId: string,
    data: {
      status: EmailTaskStatus;
      processedAt: Date;
      sentAt?: Date | null;
      lastError?: string | null;
      dueAt?: Date | null;
    },
  ) {
    const assignments = [
      Prisma.sql`"status" = CAST(${data.status} AS "EmailTaskStatus")`,
      Prisma.sql`"processedAt" = ${data.processedAt}`,
      Prisma.sql`"lastError" = ${data.lastError ?? null}`,
      Prisma.sql`"updatedAt" = NOW()`,
    ];

    if (data.sentAt !== undefined) {
      assignments.push(Prisma.sql`"sentAt" = ${data.sentAt}`);
    }

    if (data.dueAt !== undefined && data.dueAt !== null) {
      assignments.push(Prisma.sql`"dueAt" = ${data.dueAt}`);
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailTask"
      SET ${Prisma.join(assignments)}
      WHERE "id" = ${taskId}
    `);
  }

  private async processTask(task: ClaimedEmailTask) {
    this.logger.log(
      `Processing task ${task.id} assignment=${task.assignmentId} step=${task.sequenceStepOrder} dueAt=${task.dueAt.toISOString()} attempt=${task.attemptCount}`,
    );

    const context = await this.emailService.loadAssignmentTemplateContext(
      this.prisma as unknown as Prisma.TransactionClient,
      task.assignmentId,
    );

    const email = context.assignment.user.email.trim();
    if (!isValidEmail(email)) {
      this.logger.warn(
        `Cancelling task ${task.id}: invalid email address ${context.assignment.user.email}`,
      );
      await this.markTask(task.id, {
        status: "FAILED",
        processedAt: new Date(),
        lastError: `Invalid email address: ${context.assignment.user.email}`,
      });
      return;
    }

    const positionStatus = context.assignment.test.position?.status ?? PositionStatus.DRAFT;
    if (positionStatus === PositionStatus.CLOSED) {
      this.logger.warn(`Cancelling task ${task.id}: position is closed`);
      await this.markTask(task.id, {
        status: "CANCELLED",
        processedAt: new Date(),
        lastError: "Position is closed",
      });
      return;
    }

    if (context.assignment.status.includes(UserTestStatus.DISCARDED)) {
      this.logger.warn(`Cancelling task ${task.id}: candidate discarded`);
      await this.markTask(task.id, {
        status: "CANCELLED",
        processedAt: new Date(),
        lastError: "Candidate discarded",
      });
      return;
    }

    if (isSubmitted(context.assignment.status)) {
      this.logger.warn(`Cancelling task ${task.id}: candidate already submitted`);
      await this.markTask(task.id, {
        status: "CANCELLED",
        processedAt: new Date(),
        lastError: "Candidate submitted",
      });
      return;
    }

    try {
      this.logger.log(`Sending task ${task.id} to ${task.to}`);
      const result = await this.emailService.sendTask(task);
      const sentAt = new Date();

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
        UPDATE "EmailTask"
        SET
            "status" = CAST('SENT' AS "EmailTaskStatus"),
            "sentAt" = ${sentAt},
            "processedAt" = ${sentAt},
            "lastError" = NULL,
            "updatedAt" = NOW()
          WHERE "id" = ${task.id}
        `);
      });

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.emailService.queueNextSequenceEmail(tx, {
            assignmentId: task.assignmentId,
            currentStepOrder: task.sequenceStepOrder,
            sentAt,
          });
        });
      } catch (error) {
        this.logger.error(
          `Sent task ${task.id} but could not schedule next step: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (result.skipped) {
        this.logger.warn(`Task ${task.id} was not sent because EMAIL_ENABLED is false`);
        return;
      }

      this.logger.log(`Sent email task ${task.id} to ${task.to}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (task.attemptCount >= this.environment.EMAIL_WORKER_MAX_ATTEMPTS) {
        this.logger.error(`Task ${task.id} failed permanently: ${errorMessage}`);
        await this.markTask(task.id, {
          status: "FAILED",
          processedAt: new Date(),
          lastError: errorMessage,
        });
        return;
      }

      await this.markTask(task.id, {
        status: "PENDING",
        processedAt: new Date(),
        lastError: errorMessage,
        dueAt: new Date(Date.now() + this.environment.EMAIL_WORKER_RETRY_DELAY_MS),
      });
      this.logger.warn(
        `Task ${task.id} send failed, will retry in ${this.environment.EMAIL_WORKER_RETRY_DELAY_MS}ms: ${errorMessage}`,
      );
    }
  }
}
