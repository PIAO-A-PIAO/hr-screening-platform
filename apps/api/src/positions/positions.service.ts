import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PositionStatus, TestStatus, UserTestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePositionDto, PositionStatusDto } from "./positions.dto";

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
      },
    });

    if (!position) {
      throw new NotFoundException("Position not found");
    }

    const assignments = position.test?.assignments ?? [];
    const summaries = assignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
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
      invitedCandidates,
      submittedCandidates,
    };
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
}
