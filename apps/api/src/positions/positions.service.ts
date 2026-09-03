import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EmailDelayUnit,
  EmailSequenceStopCondition,
  Prisma,
  PositionStatus,
  TestStatus,
  UserTestStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreatePositionDto,
  EmailSequenceStopConditionDto,
  UpdatePositionEmailSequenceDto,
  UpdatePositionEmailSequenceStepDto,
  PositionStatusDto,
} from "./positions.dto";

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

export type PositionCandidateSummary = {
  id: string;
  userId: string;
  attemptId: string | null;
  name: string;
  email: string;
  status: UserTestStatus[];
  inviteToken: string | null;
  invitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  submitted: boolean;
};

export type PositionTestSummary = {
  id: string;
  name: string;
  description: string | null;
  status: TestStatus;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailTemplateSummary = {
  id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailSequenceStepSummary = {
  id: string;
  templateId: string;
  delayValue: number;
  delayUnit: EmailDelayUnit;
  order: number;
  stopCondition: EmailSequenceStopCondition | null;
  createdAt: Date;
  updatedAt: Date;
  template: EmailTemplateSummary;
};

export type EmailSequenceSummary = {
  id: string;
  positionId: string;
  createdAt: Date;
  updatedAt: Date;
  steps: EmailSequenceStepSummary[];
};

export type PositionSummaryResponse = {
  id: string;
  title: string;
  description: string | null;
  department: string;
  location: string;
  status: PositionStatus;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
  candidateCount: number;
  submittedCount: number;
  testState: TestStatus | "NO_TEST";
  test: PositionTestSummary | null;
  emails: EmailSequenceSummary | null;
};

export type PositionResponse = PositionSummaryResponse & {
  invitedCandidates: PositionCandidateSummary[];
  submittedCandidates: PositionCandidateSummary[];
};

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}
  private assignmentInviteTokenSupportPromise: Promise<boolean> | null = null;

  private supportsAssignmentInviteToken() {
    this.assignmentInviteTokenSupportPromise ??= this.prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'UserTestAssignment'
          AND column_name = 'inviteToken'
      ) AS "exists"
    `).then((rows) => rows[0]?.exists === true);

    return this.assignmentInviteTokenSupportPromise;
  }

  async listPositions(): Promise<PositionSummaryResponse[]> {
    const positions = await this.prisma.position.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        test: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            assignments: {
              select: {
                status: true,
              },
            },
            _count: {
              select: {
                questions: true,
              },
            },
          },
        },
      },
    });

    return positions.map((position) => {
      const candidateCount = position.test?.assignments.length ?? 0;
      const submittedCount = position.test?.assignments.filter((assignment) => isSubmitted(assignment.status)).length ?? 0;

      return {
        id: position.id,
        title: position.title,
        description: position.description,
        department: position.department,
        location: position.location,
        status: position.status,
        owner: position.owner,
        createdAt: position.createdAt,
        updatedAt: position.updatedAt,
        candidateCount,
        submittedCount,
        testState: position.test?.status ?? "NO_TEST",
        test: position.test
          ? {
              id: position.test.id,
              name: position.test.name,
              description: position.test.description,
              status: position.test.status,
              questionCount: position.test._count.questions,
              createdAt: position.test.createdAt,
              updatedAt: position.test.updatedAt,
            }
          : null,
        emails: null,
      };
    });
  }

  async createPosition(dto: CreatePositionDto): Promise<PositionResponse> {
    const created = await this.prisma.position.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        department: dto.department.trim(),
        location: dto.location.trim(),
        status: dto.status ?? PositionStatusDto.DRAFT,
        owner: dto.owner.trim(),
      },
    });

    return this.getPosition(created.id);
  }

  async getPosition(positionId: string): Promise<PositionResponse> {
    const supportsInviteToken = await this.supportsAssignmentInviteToken();
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: {
        test: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            assignments: {
              orderBy: { createdAt: "desc" },
              select: supportsInviteToken
                ? {
                    id: true,
                    userId: true,
                    status: true,
                    inviteToken: true,
                    invitedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  }
                : {
                    id: true,
                    userId: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
            },
            _count: {
              select: {
                questions: true,
              },
            },
          },
        },
        emails: {
          select: {
            id: true,
            positionId: true,
            createdAt: true,
            updatedAt: true,
            steps: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                templateId: true,
                delayValue: true,
                delayUnit: true,
                order: true,
                stopCondition: true,
                createdAt: true,
                updatedAt: true,
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
    });

    if (!position) {
      throw new NotFoundException("Position not found");
    }

    const assignments = position.test?.assignments ?? [];
    const attemptIds = position.test
      ? await this.prisma.$queryRaw<Array<{ assignmentId: string; attemptId: string | null }>>(Prisma.sql`
          SELECT
            a."assignmentId",
            a."id" AS "attemptId"
          FROM "Attempt" a
          WHERE a."testId" = ${position.test.id}
        `)
      : [];
    const summaries = assignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      attemptId: attemptIds.find((row) => row.assignmentId === assignment.id)?.attemptId ?? null,
      name: assignment.user.name,
      email: assignment.user.email,
      status: assignment.status,
      inviteToken: supportsInviteToken ? (assignment as { inviteToken?: string | null }).inviteToken ?? null : null,
      invitedAt: supportsInviteToken
        ? (assignment as { invitedAt?: Date }).invitedAt ?? assignment.createdAt
        : assignment.createdAt,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      submitted: isSubmitted(assignment.status),
    }));

    const submittedCandidates = summaries.filter((summary) => summary.submitted);
    const invitedCandidates = summaries.filter((summary) => !summary.submitted);

    return {
      id: position.id,
      title: position.title,
      description: position.description,
      department: position.department,
      location: position.location,
      status: position.status,
      owner: position.owner,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
      candidateCount: summaries.length,
      submittedCount: submittedCandidates.length,
      testState: position.test?.status ?? "NO_TEST",
      test: position.test
        ? {
            id: position.test.id,
            name: position.test.name,
            description: position.test.description,
            status: position.test.status,
            questionCount: position.test._count.questions,
            createdAt: position.test.createdAt,
            updatedAt: position.test.updatedAt,
          }
        : null,
      emails: position.emails
        ? {
            id: position.emails.id,
            positionId: position.emails.positionId,
            createdAt: position.emails.createdAt,
            updatedAt: position.emails.updatedAt,
            steps: position.emails.steps.map((step) => ({
              id: step.id,
              templateId: step.templateId,
              delayValue: step.delayValue,
              delayUnit: step.delayUnit,
              order: step.order,
              stopCondition: step.stopCondition,
              createdAt: step.createdAt,
              updatedAt: step.updatedAt,
              template: {
                id: step.template.id,
                key: step.template.key,
                name: step.template.name,
                subject: step.template.subject,
                html: step.template.html,
                text: step.template.text,
                createdAt: step.template.createdAt,
                updatedAt: step.template.updatedAt,
              },
            })),
          }
        : null,
      invitedCandidates,
      submittedCandidates,
    };
  }

  async deleteAssignment(positionId: string, assignmentId: string): Promise<{ id: string }> {
    const [assignment] = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT uta."id"
      FROM "UserTestAssignment" uta
      INNER JOIN "Test" t ON t."id" = uta."testId"
      WHERE uta."id" = ${assignmentId}
        AND t."positionId" = ${positionId}
      LIMIT 1
    `);

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const [deleted] = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      DELETE FROM "UserTestAssignment"
      WHERE "id" = ${assignmentId}
      RETURNING "id"
    `);

    if (!deleted) {
      throw new NotFoundException("Assignment not found");
    }

    return deleted;
  }

  async updateEmailSequence(
    positionId: string,
    dto: UpdatePositionEmailSequenceDto,
  ): Promise<PositionResponse> {
    this.assertValidEmailSequencePayload(dto.steps);

    const templateIds = [...new Set(dto.steps.map((step) => step.templateId))];
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        id: {
          in: templateIds,
        },
      },
      select: { id: true },
    });

    if (templates.length !== templateIds.length) {
      throw new BadRequestException("One or more email templates do not exist");
    }

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      select: {
        id: true,
        emails: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!position) {
      throw new NotFoundException("Position not found");
    }

    await this.prisma.$transaction(async (tx) => {
      const sequenceId = position.emails?.id
        ?? (await tx.emailSequence.create({
          data: {
            positionId,
          },
          select: { id: true },
        })).id;

      await tx.emailSequenceStep.deleteMany({
        where: {
          sequenceId,
        },
      });

      const sortedSteps = [...dto.steps].sort((left, right) => left.order - right.order);
      for (const step of sortedSteps) {
        await tx.emailSequenceStep.create({
          data: {
            sequenceId,
            templateId: step.templateId,
            delayValue: step.delayValue,
            delayUnit: step.delayUnit as EmailDelayUnit,
            order: step.order,
            stopCondition: step.stopCondition
              ? (step.stopCondition as EmailSequenceStopCondition)
              : null,
          },
        });
      }
    });

    return this.getPosition(positionId);
  }

  async assertPositionAcceptsNewTest(positionId: string) {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      select: {
        id: true,
        test: {
          select: { id: true },
        },
      },
    });

    if (!position) {
      throw new NotFoundException("Position not found");
    }

    if (position.test) {
      throw new BadRequestException("Position already has an attached test");
    }

    return position;
  }

  private assertValidEmailSequencePayload(steps: UpdatePositionEmailSequenceStepDto[]) {
    if (steps.length < 2) {
      throw new BadRequestException("At least two email steps are required");
    }

    const orders = steps.map((step) => step.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new BadRequestException("Email step order values must be unique");
    }

    const normalizedOrders = [...orders].sort((left, right) => left - right);
    for (let index = 0; index < normalizedOrders.length; index += 1) {
      const expectedOrder = index + 1;
      if (normalizedOrders[index] !== expectedOrder) {
        throw new BadRequestException("Email step order values must start at 1 and be consecutive");
      }
    }

    for (const step of steps) {
      if (step.delayValue < 1) {
        throw new BadRequestException("Email delays must be positive");
      }
    }
  }
}
