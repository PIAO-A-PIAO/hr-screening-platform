import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InterviewWorkflowStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Reviewer } from "./reviewer-auth";
import { allowedTransitions, WorkflowStatus, WORKFLOW_STATUSES } from "./stage-policy";
import { CandidatePipelineSort, ListCandidatePipelineDto } from "./candidate-stages.dto";
import { ImportPositionCandidatesDto, InvitePositionCandidateDto } from "./candidate-stages.dto";
import { EmailService } from "../email/email.service";
import { randomUUID } from "node:crypto";

const selection = {
  id: true,
  workflowStatus: true,
  workflowRevision: true,
  inviteToken: true,
  invitedAt: true,
  candidate: { select: { id: true, name: true, email: true } },
  attempt: { select: { id: true, status: true, submittedAt: true, scoreSum: true } },
  emailTasks: {
    where: { status: "SENT" as const },
    orderBy: { sentAt: "desc" as const },
    select: {
      id: true,
      subject: true,
      sentAt: true,
      sequenceStepOrder: true,
      template: { select: { key: true, name: true } },
    },
  },
} satisfies Prisma.InterviewSelect;

@Injectable()
export class CandidateStagesService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  private presentInterview(row: Prisma.InterviewGetPayload<{ select: typeof selection }>) {
    const { emailTasks, ...interview } = row;
    return {
      ...interview,
      allowedTransitions: allowedTransitions(row.workflowStatus),
      emailHistory: emailTasks.map((task) => ({
        id: task.id,
        type: task.template.key,
        templateName: task.template.name,
        subject: task.subject,
        sentAt: task.sentAt,
        sequenceStepOrder: task.sequenceStepOrder,
      })),
    };
  }

  async list(positionId: string, query: ListCandidatePipelineDto, reviewer: Reviewer) {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      select: { id: true, title: true, status: true },
    });
    if (!position) throw new NotFoundException("Position not found");
    const status = query.status ?? "INVITED";
    const search = query.search?.trim();
    const orderBy: Prisma.InterviewOrderByWithRelationInput[] = query.sort === CandidatePipelineSort.INVITED_ASC
      ? [{ invitedAt: "asc" }, { id: "asc" }]
      : query.sort === CandidatePipelineSort.NAME_ASC
        ? [{ candidate: { name: "asc" } }, { invitedAt: "desc" }]
        : [{ invitedAt: "desc" }, { id: "asc" }];

    const rows = await this.prisma.interview.findMany({
      where: {
        positionId,
        workflowStatus: status,
        ...(search ? { candidate: { name: { contains: search, mode: "insensitive" } } } : {}),
      },
      select: selection,
      orderBy,
    });
    const grouped = await this.prisma.interview.groupBy({
      by: ["workflowStatus"],
      where: { positionId },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(WORKFLOW_STATUSES.map((status) => [status, 0])) as Record<WorkflowStatus, number>;
    for (const group of grouped) counts[group.workflowStatus] = group._count._all;
    const interviews = rows.map((row) => this.presentInterview(row));
    return { position, statuses: WORKFLOW_STATUSES, activeStatus: status, counts, interviews, reviewer };
  }

  async get(positionId: string, interviewId: string) {
    const row = await this.prisma.interview.findFirst({
      where: { id: interviewId, positionId },
      select: selection,
    });
    if (!row) throw new NotFoundException("Candidate interview not found in this position");
    return this.presentInterview(row);
  }

  async invite(positionId: string, input: InvitePositionCandidateDto) {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email.trim().toLowerCase();
    if (!firstName || !lastName) throw new BadRequestException("First name and last name are required");

    return this.prisma.$transaction(async (tx) => {
      const position = await tx.position.findUnique({
        where: { id: positionId },
        select: { id: true, status: true, test: { select: { id: true } } },
      });
      if (!position) throw new NotFoundException("Position not found");
      if (position.status === "CLOSED") throw new BadRequestException("Closed positions cannot accept invitations");
      if (!position.test) throw new BadRequestException("Attach a test before inviting candidates");

      const candidate = await tx.candidate.upsert({
        where: { email },
        create: { name: `${firstName} ${lastName}`, email },
        update: { name: `${firstName} ${lastName}` },
      });
      const existing = await tx.interview.findUnique({
        where: { candidateId_positionId: { candidateId: candidate.id, positionId } },
        select: selection,
      });
      if (existing) return { interview: this.presentInterview(existing), created: false, message: "Candidate is already invited to this position" };

      const interview = await tx.interview.create({
        data: {
          candidateId: candidate.id,
          positionId,
          testId: position.test.id,
          workflowStatus: "INVITED",
          inviteToken: randomUUID(),
          inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        select: selection,
      });
      await this.email.queueInvitationEmail(tx, { assignmentId: interview.id });
      return { interview: this.presentInterview(interview), created: true, message: "Invitation created" };
    });
  }

  async importCandidates(positionId: string, input: ImportPositionCandidatesDto) {
    const seen = new Set<string>();
    const rows: Array<{ row: number; email: string; status: "IMPORTED" | "SKIPPED" | "INVALID"; message: string }> = [];

    for (const [index, item] of input.rows.entries()) {
      const row = item.row ?? index + 2;
      const email = item.email?.trim().toLowerCase() ?? "";
      const parts = item.name?.trim().split(/\s+/).filter(Boolean) ?? [];
      const firstName = item.firstName?.trim() || parts[0] || "";
      const lastName = item.lastName?.trim() || parts.slice(1).join(" ");
      if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) {
        rows.push({ row, email, status: "INVALID", message: "A valid name and email are required" });
        continue;
      }
      if (seen.has(email)) {
        rows.push({ row, email, status: "SKIPPED", message: "Duplicate email in CSV" });
        continue;
      }
      seen.add(email);
      try {
        const result = await this.invite(positionId, { firstName, lastName, email });
        rows.push({ row, email, status: result.created ? "IMPORTED" : "SKIPPED", message: result.message });
      } catch (caught) {
        rows.push({ row, email, status: "INVALID", message: caught instanceof Error ? caught.message : "Import failed" });
      }
    }

    return {
      totalRows: input.rows.length,
      imported: rows.filter((row) => row.status === "IMPORTED").length,
      skipped: rows.filter((row) => row.status === "SKIPPED").length,
      invalid: rows.filter((row) => row.status === "INVALID").length,
      rows,
    };
  }

  async remove(positionId: string, interviewId: string) {
    const result = await this.prisma.interview.deleteMany({ where: { id: interviewId, positionId } });
    if (result.count !== 1) throw new NotFoundException("Candidate interview not found in this position");
    return { id: interviewId };
  }

  async history(positionId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({ where: { id: interviewId, positionId }, select: { id: true } });
    if (!interview) throw new NotFoundException("Candidate interview not found in this position");
    const rows = await this.prisma.interviewStatusChange.findMany({
      where: { interviewId, positionId },
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => ({
      ...row,
      fromStage: row.fromStatus,
      toStage: row.toStatus,
    }));
  }

  async change(positionId: string, interviewId: string, input: {
    stage: WorkflowStatus;
    expectedStage: WorkflowStatus;
    expectedRevision: number;
  }, reviewer: Reviewer) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "UserTestAssignment"
        WHERE "id" = ${interviewId} AND "positionId" = ${positionId}
        FOR UPDATE
      `);
      const row = await tx.interview.findFirst({ where: { id: interviewId, positionId }, select: selection });
      if (!row) throw new NotFoundException("Candidate interview not found in this position");
      if (row.workflowRevision !== input.expectedRevision || row.workflowStatus !== input.expectedStage) {
        throw new ConflictException("This candidate changed. Refresh and try again.");
      }
      if (!allowedTransitions(row.workflowStatus).includes(input.stage)) {
        throw new BadRequestException(`Cannot move from ${row.workflowStatus} to ${input.stage}`);
      }
      await tx.interview.update({
        where: { id: interviewId },
        data: { workflowStatus: input.stage as InterviewWorkflowStatus, workflowRevision: { increment: 1 } },
      });
      const change = await tx.interviewStatusChange.create({
        data: {
          interviewId,
          positionId,
          candidateId: row.candidate.id,
          fromStatus: row.workflowStatus,
          toStatus: input.stage as InterviewWorkflowStatus,
          actorId: reviewer.id,
          actorName: reviewer.name,
        },
      });
      if (input.stage === "DISCARDED") {
        await tx.emailTask.updateMany({
          where: { interviewId, status: "PENDING" },
          data: { status: "CANCELLED", processedAt: new Date(), lastError: `Candidate status: ${input.stage}` },
        });
      }
      return { ...change, assignmentId: interviewId, fromStage: change.fromStatus, toStage: change.toStatus };
    });
  }
}
