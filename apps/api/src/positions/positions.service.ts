import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EmailDelayUnit,
  EmailSequenceStopCondition,
  InterviewWorkflowStatus,
  PositionStatus,
  Prisma,
  TestStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreatePositionDto,
  ListPositionsQueryDto,
  PositionSortDto,
  PositionStatusDto,
  UpdatePositionEmailSequenceDto,
  UpdatePositionEmailSequenceStepDto,
} from "./positions.dto";

export type WorkflowCounts = Record<InterviewWorkflowStatus, number>;

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
  tags: string[];
  departments: Array<{ id: string; name: string }>;
  status: PositionStatus;
  createdAt: Date;
  updatedAt: Date;
  candidateCount: number;
  submittedCount: number;
  workflowCounts: WorkflowCounts;
  testState: TestStatus | "NO_TEST";
  test: PositionTestSummary | null;
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

export type EmailSequenceSummary = {
  id: string;
  positionId: string;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: string;
    templateId: string;
    delayValue: number;
    delayUnit: EmailDelayUnit;
    order: number;
    stopCondition: EmailSequenceStopCondition | null;
    createdAt: Date;
    updatedAt: Date;
    template: EmailTemplateSummary;
  }>;
};

export type PositionResponse = PositionSummaryResponse & {
  emails: EmailSequenceSummary | null;
};

const positionInclude = {
  departments: { select: { id: true, name: true } },
  interviews: { select: { workflowStatus: true } },
  test: {
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { questions: true } },
    },
  },
} satisfies Prisma.PositionInclude;

const emailInclude = {
  emails: {
    select: {
      id: true,
      positionId: true,
      createdAt: true,
      updatedAt: true,
      steps: {
        orderBy: { order: "asc" as const },
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
} satisfies Prisma.PositionInclude;

type PositionWithSummary = Prisma.PositionGetPayload<{ include: typeof positionInclude }>;
type PositionWithDetails = Prisma.PositionGetPayload<{ include: typeof positionInclude & typeof emailInclude }>;

function normalizeTags(tags: string[] = []) {
  const byKey = new Map<string, string>();
  for (const value of tags) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized) byKey.set(normalized.toLocaleLowerCase(), normalized);
  }
  return [...byKey.values()];
}

function workflowCounts(interviews: Array<{ workflowStatus: InterviewWorkflowStatus }>): WorkflowCounts {
  const counts: WorkflowCounts = {
    INVITED: 0,
    TO_EVALUATE: 0,
    SHORTLISTED: 0,
    DISCARDED: 0,
  };
  for (const interview of interviews) counts[interview.workflowStatus] += 1;
  return counts;
}

function toSummary(position: PositionWithSummary): PositionSummaryResponse {
  const counts = workflowCounts(position.interviews);
  return {
    id: position.id,
    title: position.title,
    description: position.description,
    tags: position.tags,
    departments: position.departments,
    status: position.status,
    createdAt: position.createdAt,
    updatedAt: position.updatedAt,
    candidateCount: position.interviews.length,
    submittedCount: counts.TO_EVALUATE + counts.SHORTLISTED + counts.DISCARDED,
    workflowCounts: counts,
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
}

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPositions(query: ListPositionsQueryDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const selectedTags = normalizeTags((query.tags ?? "").split(","));
    const search = query.search?.trim();
    const status = query.status as PositionStatus | undefined;
    const where: Prisma.PositionWhereInput = {
      ...(status ? { status } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      ...(selectedTags.length > 0 ? { tags: { hasEvery: selectedTags } } : {}),
    };
    const orderBy: Prisma.PositionOrderByWithRelationInput = query.sort === PositionSortDto.CREATED_ASC
      ? { createdAt: "asc" }
      : query.sort === PositionSortDto.TITLE_ASC
        ? { title: "asc" }
        : { createdAt: "desc" };

    const [rows, total, tagRows] = await this.prisma.$transaction([
      this.prisma.position.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: positionInclude,
      }),
      this.prisma.position.count({ where }),
      this.prisma.position.findMany({
        where: status ? { status } : {},
        select: { tags: true },
      }),
    ]);

    return {
      items: rows.map(toSummary),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      availableTags: normalizeTags(tagRows.flatMap((row) => row.tags)).sort((a, b) => a.localeCompare(b)),
    };
  }

  async createPosition(dto: CreatePositionDto): Promise<PositionResponse> {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException("Position title is required");
    const departmentIds = [...new Set(dto.departmentIds ?? [])];
    if (departmentIds.length > 0) {
      const count = await this.prisma.department.count({ where: { id: { in: departmentIds } } });
      if (count !== departmentIds.length) throw new BadRequestException("One or more departments do not exist");
    }
    const created = await this.prisma.position.create({
      data: {
        title,
        description: dto.description?.trim() || null,
        tags: normalizeTags(dto.tags),
        status: (dto.status ?? PositionStatusDto.DRAFT) as PositionStatus,
        departments: { connect: departmentIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });
    return this.getPosition(created.id);
  }

  async getPosition(positionId: string): Promise<PositionResponse> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: { ...positionInclude, ...emailInclude },
    });
    if (!position) throw new NotFoundException("Position not found");
    const summary = toSummary(position as PositionWithDetails);
    return { ...summary, emails: position.emails };
  }

  async updateStatus(positionId: string, status: PositionStatusDto): Promise<PositionResponse> {
    const result = await this.prisma.position.updateMany({
      where: { id: positionId },
      data: { status: status as PositionStatus },
    });
    if (result.count !== 1) throw new NotFoundException("Position not found");
    return this.getPosition(positionId);
  }

  async deleteInterview(positionId: string, interviewId: string): Promise<{ id: string }> {
    const result = await this.prisma.interview.deleteMany({ where: { id: interviewId, positionId } });
    if (result.count !== 1) throw new NotFoundException("Interview not found");
    return { id: interviewId };
  }

  async updateEmailSequence(positionId: string, dto: UpdatePositionEmailSequenceDto): Promise<PositionResponse> {
    this.assertValidEmailSequencePayload(dto.steps);
    const templateIds = [...new Set(dto.steps.map((step) => step.templateId))];
    const templates = await this.prisma.emailTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true } });
    if (templates.length !== templateIds.length) throw new BadRequestException("One or more email templates do not exist");
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true, emails: { select: { id: true } } } });
    if (!position) throw new NotFoundException("Position not found");

    await this.prisma.$transaction(async (tx) => {
      const sequenceId = position.emails?.id ?? (await tx.emailSequence.create({ data: { positionId }, select: { id: true } })).id;
      await tx.emailSequenceStep.deleteMany({ where: { sequenceId } });
      for (const step of [...dto.steps].sort((left, right) => left.order - right.order)) {
        await tx.emailSequenceStep.create({
          data: {
            sequenceId,
            templateId: step.templateId,
            delayValue: step.delayValue,
            delayUnit: step.delayUnit as EmailDelayUnit,
            order: step.order,
            stopCondition: step.stopCondition ? step.stopCondition as EmailSequenceStopCondition : null,
          },
        });
      }
    });
    return this.getPosition(positionId);
  }

  async assertPositionAcceptsNewTest(positionId: string) {
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true, test: { select: { id: true } } } });
    if (!position) throw new NotFoundException("Position not found");
    if (position.test) throw new BadRequestException("Position already has an attached test");
    return position;
  }

  private assertValidEmailSequencePayload(steps: UpdatePositionEmailSequenceStepDto[]) {
    if (steps.length < 2) throw new BadRequestException("At least two email steps are required");
    const orders = steps.map((step) => step.order);
    if (new Set(orders).size !== orders.length) throw new BadRequestException("Email step order values must be unique");
    const normalized = [...orders].sort((left, right) => left - right);
    if (normalized.some((order, index) => order !== index + 1)) {
      throw new BadRequestException("Email step order values must start at 1 and be consecutive");
    }
    if (steps.some((step) => step.delayValue < 1)) throw new BadRequestException("Email delays must be positive");
  }
}
