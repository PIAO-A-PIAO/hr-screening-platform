import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EmailDelayUnit,
  EmailSequenceStopCondition,
  EmailSequenceTrigger,
  InterviewWorkflowStatus,
  PositionStatus,
  Prisma,
  TestStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { Principal } from "../auth/auth.service";
import { UserRole } from "@prisma/client";
import {
  CreatePositionDto,
  ListPositionsQueryDto,
  PositionSortDto,
  PositionStatusDto,
  UpdatePositionDto,
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
  content: string;
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
    trigger: EmailSequenceTrigger;
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
          trigger: true,
          stopCondition: true,
          createdAt: true,
          updatedAt: true,
          template: {
            select: {
              id: true,
              key: true,
              name: true,
              subject: true,
              content: true,
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
    PHASE_1: 0,
    PHASE_2: 0,
    PHASE_3: 0,
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
    tags: position.tags,
    departments: position.departments,
    status: position.status,
    createdAt: position.createdAt,
    updatedAt: position.updatedAt,
    candidateCount: position.interviews.length,
    submittedCount: counts.TO_EVALUATE + counts.PHASE_1 + counts.PHASE_2 + counts.PHASE_3 + counts.DISCARDED,
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

  async listPositions(query: ListPositionsQueryDto = {}, user?: Principal) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const selectedTags = normalizeTags((query.tags ?? "").split(","));
    const search = query.search?.trim();
    const status = query.status as PositionStatus | undefined;
    const where: Prisma.PositionWhereInput = {
      ...(user?.role === UserRole.RECRUITER ? { departments: { some: { id: { in: user.departments.map(d => d.id) } } } } : {}),
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
        where: { ...where, ...(status ? { status } : {}) },
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
    const defaultTemplates = await this.prisma.emailTemplate.findMany({
      where: { key: { in: ["invitation_default", "final_reminder_default", "completion_default"] } },
      select: { id: true, key: true },
    });
    const byKey = new Map(defaultTemplates.map((template) => [template.key, template.id]));
    const defaultSteps = [
      { key: "invitation_default", trigger: EmailSequenceTrigger.INVITATION, delayValue: 0, order: 1 },
      { key: "final_reminder_default", trigger: EmailSequenceTrigger.NO_RESPONSE, delayValue: 48, order: 2 },
      { key: "completion_default", trigger: EmailSequenceTrigger.INTERVIEW_COMPLETED, delayValue: 0, order: 3 },
    ].flatMap(({ key, ...step }) => byKey.has(key) ? [{ ...step, templateId: byKey.get(key)!, delayUnit: EmailDelayUnit.HOURS }] : []);
    const created = await this.prisma.position.create({
      data: {
        title,
        tags: normalizeTags(dto.tags),
        status: (dto.status ?? PositionStatusDto.OPEN) as PositionStatus,
        departments: { connect: departmentIds.map((id) => ({ id })) },
        ...(defaultSteps.length ? { emails: { create: { steps: { create: defaultSteps.map((step, index) => ({ ...step, order: index + 1 })) } } } } : {}),
      },
      select: { id: true },
    });
    return this.getPosition(created.id);
  }

  async getOptions(user?: Principal) {
    const ids = user?.role === UserRole.RECRUITER ? user.departments.map(d => d.id) : null;
    const [positions, departments] = await Promise.all([
      this.prisma.position.findMany({ where: ids ? { departments: { some: { id: { in: ids } } } } : {}, select: { tags: true } }),
      this.prisma.department.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return {
      tags: normalizeTags(positions.flatMap((position) => position.tags)).sort((left, right) => left.localeCompare(right)),
      departments,
    };
  }

  async createDepartment(value: string) {
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || name.length > 80) throw new BadRequestException("Department name must be 1–80 characters");
    const existing = await this.prisma.department.findMany({ select: { name: true } });
    if (existing.some((department) => department.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new BadRequestException("Department already exists");
    }
    try {
      const department = await this.prisma.department.create({ data: { name }, select: { id: true, name: true } });
      return department;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Department already exists");
      }
      throw error;
    }
  }

  async deleteDepartment(departmentId: string) {
    const result = await this.prisma.department.deleteMany({ where: { id: departmentId } });
    if (!result.count) throw new NotFoundException("Department not found");
    return this.getOptions();
  }

  async deleteTag(value: string) {
    const tag = value.trim().replace(/\s+/g, " ");
    if (!tag) throw new BadRequestException("Tag is required");
    const key = tag.toLocaleLowerCase();
    const positions = await this.prisma.position.findMany({ select: { id: true, tags: true } });
    const affected = positions
      .map((position) => ({
        id: position.id,
        tags: position.tags.filter((current) => current.trim().replace(/\s+/g, " ").toLocaleLowerCase() !== key),
      }))
      .filter((position, index) => position.tags.length !== positions[index].tags.length);
    if (affected.length > 0) {
      await this.prisma.$transaction(affected.map((position) => this.prisma.position.update({
        where: { id: position.id },
        data: { tags: position.tags },
      })));
    }
    return this.getOptions();
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

  async updatePosition(positionId: string, dto: UpdatePositionDto): Promise<PositionResponse> {
    const title = dto.title === undefined ? undefined : dto.title.trim().replace(/\s+/g, " ");
    if (title !== undefined && !title) throw new BadRequestException("Position title is required");
    const departmentIds = dto.departmentIds === undefined ? undefined : [...new Set(dto.departmentIds)];
    if (departmentIds) {
      const count = await this.prisma.department.count({ where: { id: { in: departmentIds } } });
      if (count !== departmentIds.length) throw new BadRequestException("One or more departments do not exist");
    }
    try {
      await this.prisma.position.update({
        where: { id: positionId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
          ...(departmentIds !== undefined
            ? { departments: { set: departmentIds.map((id) => ({ id })) } }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundException("Position not found");
      }
      throw error;
    }
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
            trigger: step.trigger as EmailSequenceTrigger,
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
    const orders = steps.map((step) => step.order);
    if (new Set(orders).size !== orders.length) throw new BadRequestException("Email step order values must be unique");
    const normalized = [...orders].sort((left, right) => left - right);
    if (normalized.some((order, index) => order !== index + 1)) {
      throw new BadRequestException("Email step order values must start at 1 and be consecutive");
    }
    if (steps.some((step) => step.delayValue < 0)) throw new BadRequestException("Email delays cannot be negative");
    if (steps.some((step) => step.trigger === "NO_RESPONSE" && step.delayValue <= 0)) {
      throw new BadRequestException("No-response rules require a positive delay");
    }
  }
}
