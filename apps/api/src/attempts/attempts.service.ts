import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ResponsesService } from "../responses/responses.service";
import { CreateResponseDto } from "../responses/responses.dto";
import { StartAttemptDto } from "./attempts.dto";

type AttemptRow = {
  id: string;
  assignmentId: string;
  testId: string;
  userId: string;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  scoreSum: number | null;
  scoreState: string;
  createdAt: Date;
  updatedAt: Date;
};

type AttemptResponseRow = {
  id: string;
  testId: string;
  userId: string;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  scoreSum: number | null;
  scoreState: string;
  createdAt: Date;
  updatedAt: Date;
  assignmentId: string;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  test: {
    id: string;
    name: string;
    description: string | null;
    status: TestStatus;
  };
  responseCount: number;
};

type AttemptDetailResponse = AttemptResponseRow & {
  responses: Array<{
    id: string;
    type: string;
    questionId: string;
    questionTitle: string;
    score: number | null;
    createdAt: Date;
    updatedAt: Date;
    item: Record<string, unknown>;
  }>;
};

type InviteTokenLookupRow = {
  assignmentId: string;
  testId: string;
  userId: string;
};

const attemptResponseInclude = {
  question: true,
  videoItem: { include: { asset: true } },
  multipleChoiceItem: {
    include: {
      selections: {
        include: { option: true },
        orderBy: { option: { order: "asc" as const } },
      },
    },
  },
  shortAnswerItem: true,
} satisfies Prisma.ResponseInclude;

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly responses: ResponsesService,
  ) {}

  async resolveInviteToken(inviteToken: string) {
    const normalized = inviteToken.trim();
    if (!normalized) {
      throw new BadRequestException("inviteToken is required");
    }

    const [assignment] = await this.prisma.$queryRaw<Array<InviteTokenLookupRow>>(Prisma.sql`
      SELECT
        "id" AS "assignmentId",
        "testId",
        "userId"
      FROM "UserTestAssignment"
      WHERE "inviteToken" = ${normalized}
      LIMIT 1
    `);

    if (!assignment) {
      throw new NotFoundException("Invitation token not found");
    }

    return assignment;
  }

  async startAttempt(dto: StartAttemptDto, inviteToken?: string) {
    const assignment = await this.loadAssignment(dto.userId, dto.testId, inviteToken);
    const existing = await this.loadAttemptByAssignmentId(assignment.id);

    if (existing) {
      if (existing.status === "SUBMITTED") {
        throw new ConflictException("Attempt already submitted");
      }
      return this.getAttempt(existing.id, inviteToken);
    }

    const [created] = await this.prisma.$queryRaw<AttemptRow[]>(Prisma.sql`
      INSERT INTO "Attempt" (
        "id",
        "assignmentId",
        "testId",
        "userId",
        "status",
        "startedAt",
        "scoreState",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${cryptoRandomId()},
        ${assignment.id},
        ${dto.testId},
        ${dto.userId},
        'IN_PROGRESS',
        NOW(),
        'PENDING',
        NOW(),
        NOW()
      )
      RETURNING
        "id",
        "assignmentId",
        "testId",
        "userId",
        "status",
        "startedAt",
        "submittedAt",
        "scoreSum",
        "scoreState",
        "createdAt",
        "updatedAt"
    `);

    if (!created) {
      throw new NotFoundException("Failed to create attempt");
    }

    return this.getAttempt(created.id, inviteToken);
  }

  async saveAttemptResponse(attemptId: string, dto: CreateResponseDto, inviteToken?: string) {
    const attempt = await this.loadAttemptWithAssignment(attemptId, inviteToken);
    if (attempt.status !== "IN_PROGRESS") {
      throw new ForbiddenException("Attempt is no longer editable");
    }

    return this.responses.saveResponseInAttempt(
      {
        type: dto.type,
        questionId: dto.questionId,
        userId: dto.userId,
        testId: dto.testId,
        item: dto.item,
      },
      attemptId,
    );
  }

  async submitAttempt(attemptId: string, inviteToken?: string) {
    const attempt = await this.loadAttemptWithAssignment(attemptId, inviteToken);
    if (attempt.status === "SUBMITTED") {
      throw new ConflictException("Attempt already submitted");
    }
    if (attempt.status !== "IN_PROGRESS") {
      throw new ForbiddenException("Attempt is not editable");
    }

    const questionRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Question"
      WHERE "testId" = ${attempt.testId}
      ORDER BY "order" ASC
    `);
    const responseRows = await this.prisma.$queryRaw<Array<{ questionId: string; score: number | null }>>(Prisma.sql`
      SELECT "questionId", "score"
      FROM "Response"
      WHERE "attemptId" = ${attemptId}
    `);

    const respondedIds = new Set(responseRows.map((row) => row.questionId));
    const missing = questionRows.map((row) => row.id).filter((questionId) => !respondedIds.has(questionId));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing responses for questionIds: ${missing.join(", ")}`);
    }

    const scoreSum = responseRows.reduce((total, row) => total + (row.score ?? 0), 0);
    const scoredCount = responseRows.filter((row) => row.score !== null).length;
    const scoreState = scoredCount === 0
      ? "PENDING"
      : scoredCount === responseRows.length
        ? "FINAL"
        : "PARTIAL";

    await this.prisma.$transaction([
      this.prisma.$executeRaw(Prisma.sql`
        UPDATE "Attempt"
        SET "status" = 'SUBMITTED',
            "submittedAt" = NOW(),
            "scoreSum" = ${scoreSum},
            "scoreState" = ${scoreState}::"AttemptScoreState",
            "updatedAt" = NOW()
        WHERE "id" = ${attemptId}
      `),
      this.prisma.$executeRaw(Prisma.sql`
        UPDATE "UserTestAssignment"
        SET "status" = ARRAY(
          SELECT DISTINCT unnest("status" || ARRAY['TO_BE_EVALUATED']::"UserTestStatus"[])
        ),
            "updatedAt" = NOW()
        WHERE "id" = ${attempt.assignmentId}
      `),
    ]);

    return this.getAttempt(attemptId, inviteToken);
  }

  async getAttempt(attemptId: string, inviteToken?: string) {
    const attempt = await this.loadAttemptWithAssignment(attemptId, inviteToken);
    const responses = await this.prisma.response.findMany({
      where: { attemptId },
      orderBy: { createdAt: "asc" },
      include: attemptResponseInclude,
    });

    return {
      id: attempt.id,
      testId: attempt.testId,
      userId: attempt.userId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      scoreSum: attempt.scoreSum,
      scoreState: attempt.scoreState,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      assignmentId: attempt.assignmentId,
      candidate: attempt.candidate,
      test: attempt.test,
      responseCount: attempt.responseCount,
      responses: responses.map((response) => ({
        id: response.id,
        type: response.type,
        questionId: response.questionId,
        questionTitle: response.question.title,
        score: response.score,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        item: response.type === "VIDEO"
          ? {
              type: response.type,
              video: response.videoItem?.asset
                ? {
                    assetId: response.videoItem.asset.id,
                    mimeType: response.videoItem.asset.mimeType,
                    size: response.videoItem.asset.size,
                    durationSeconds: response.videoItem.asset.durationSeconds,
                    checksum: response.videoItem.asset.checksum,
                    createdAt: response.videoItem.asset.createdAt,
                  }
                : null,
            }
          : response.type === "MULTIPLE_CHOICE"
            ? {
                type: response.type,
                selectedOptions: response.multipleChoiceItem?.selections.map(({ option }) => ({
                  id: option.id,
                  label: option.label,
                  value: option.value,
                  order: option.order,
                })) ?? [],
              }
            : {
                type: response.type,
                textValue: response.shortAnswerItem?.textValue ?? "",
              },
      })),
    } satisfies AttemptDetailResponse;
  }

  async listAttemptsForTest(testId: string) {
    const attempts = await this.prisma.$queryRaw<Array<AttemptResponseRow>>(Prisma.sql`
      SELECT
        a."id",
        a."testId",
        a."userId",
        a."status",
        a."startedAt",
        a."submittedAt",
        a."scoreSum",
        a."scoreState",
        a."createdAt",
        a."updatedAt",
        a."assignmentId",
        COUNT(r."id")::int AS "responseCount",
        u."id" AS "candidateId",
        u."name" AS "candidateName",
        u."email" AS "candidateEmail",
        t."id" AS "testCandidateId",
        t."name" AS "testName",
        t."description" AS "testDescription",
        t."status" AS "testStatus"
      FROM "Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      JOIN "Test" t ON t."id" = a."testId"
      LEFT JOIN "Response" r ON r."attemptId" = a."id"
      WHERE a."testId" = ${testId}
      GROUP BY
        a."id",
        a."testId",
        a."userId",
        a."status",
        a."startedAt",
        a."submittedAt",
        a."scoreSum",
        a."scoreState",
        a."createdAt",
        a."updatedAt",
        a."assignmentId",
        u."id",
        u."name",
        u."email",
        t."id",
        t."name",
        t."description",
        t."status"
      ORDER BY a."createdAt" DESC
    `);

    return attempts.map((attempt) => ({
      id: attempt.id,
      testId: attempt.testId,
      userId: attempt.userId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      scoreSum: attempt.scoreSum,
      scoreState: attempt.scoreState,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      assignmentId: attempt.assignmentId,
      responseCount: attempt.responseCount,
      candidate: {
        id: (attempt as unknown as { candidateId: string }).candidateId,
        name: (attempt as unknown as { candidateName: string }).candidateName,
        email: (attempt as unknown as { candidateEmail: string }).candidateEmail,
      },
      test: {
        id: (attempt as unknown as { testCandidateId: string }).testCandidateId,
        name: (attempt as unknown as { testName: string }).testName,
        description: (attempt as unknown as { testDescription: string | null }).testDescription,
        status: (attempt as unknown as { testStatus: TestStatus }).testStatus,
      },
    }));
  }

  private async loadAssignment(userId: string, testId: string, inviteToken?: string) {
    const assignment = await this.prisma.userTestAssignment.findUnique({
      where: { userId_testId: { userId, testId } },
      select: { id: true, inviteToken: true },
    });

    if (!assignment) {
      throw new ForbiddenException("Candidate is not assigned to this test");
    }

    if (!inviteToken || assignment.inviteToken !== inviteToken.trim()) {
      throw new ForbiddenException("A valid invite token is required");
    }

    return assignment;
  }

  private async loadAttemptByAssignmentId(assignmentId: string) {
    const [attempt] = await this.prisma.$queryRaw<Array<AttemptRow>>(Prisma.sql`
      SELECT
        "id",
        "assignmentId",
        "testId",
        "userId",
        "status",
        "startedAt",
        "submittedAt",
        "scoreSum",
        "scoreState",
        "createdAt",
        "updatedAt"
      FROM "Attempt"
      WHERE "assignmentId" = ${assignmentId}
      LIMIT 1
    `);

    return attempt ?? null;
  }

  private async loadAttemptWithAssignment(attemptId: string, inviteToken?: string) {
    const [attempt] = await this.prisma.$queryRaw<Array<AttemptResponseRow>>(Prisma.sql`
      SELECT
        a."id",
        a."testId",
        a."userId",
        a."status",
        a."startedAt",
        a."submittedAt",
        a."scoreSum",
        a."scoreState",
        a."createdAt",
        a."updatedAt",
        a."assignmentId",
        COUNT(r."id")::int AS "responseCount",
        u."id" AS "candidateId",
        u."name" AS "candidateName",
        u."email" AS "candidateEmail",
        t."id" AS "testCandidateId",
        t."name" AS "testName",
        t."description" AS "testDescription",
        t."status" AS "testStatus",
        ua."inviteToken" AS "assignmentInviteToken"
      FROM "Attempt" a
      JOIN "UserTestAssignment" ua ON ua."id" = a."assignmentId"
      JOIN "User" u ON u."id" = a."userId"
      JOIN "Test" t ON t."id" = a."testId"
      LEFT JOIN "Response" r ON r."attemptId" = a."id"
      WHERE a."id" = ${attemptId}
      GROUP BY
        a."id",
        a."testId",
        a."userId",
        a."status",
        a."startedAt",
        a."submittedAt",
        a."scoreSum",
        a."scoreState",
        a."createdAt",
        a."updatedAt",
        a."assignmentId",
        u."id",
        u."name",
        u."email",
        t."id",
        t."name",
        t."description",
        t."status",
        ua."inviteToken"
      LIMIT 1
    `);

    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }

    if (!inviteToken || (attempt as unknown as { assignmentInviteToken?: string | null }).assignmentInviteToken !== inviteToken.trim()) {
      throw new ForbiddenException("A valid invite token is required");
    }

    return {
      id: attempt.id,
      testId: attempt.testId,
      userId: attempt.userId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      scoreSum: attempt.scoreSum,
      scoreState: attempt.scoreState,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      assignmentId: attempt.assignmentId,
      responseCount: attempt.responseCount,
      candidate: {
        id: (attempt as unknown as { candidateId: string }).candidateId,
        name: (attempt as unknown as { candidateName: string }).candidateName,
        email: (attempt as unknown as { candidateEmail: string }).candidateEmail,
      },
      test: {
        id: (attempt as unknown as { testCandidateId: string }).testCandidateId,
        name: (attempt as unknown as { testName: string }).testName,
        description: (attempt as unknown as { testDescription: string | null }).testDescription,
        status: (attempt as unknown as { testStatus: TestStatus }).testStatus,
      },
    };
  }
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() ?? `attempt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
