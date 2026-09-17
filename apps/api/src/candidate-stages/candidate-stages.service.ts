import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InterviewWorkflowStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Reviewer } from "./reviewer-auth";
import { allowedTransitions, WorkflowStatus, WORKFLOW_STATUSES } from "./stage-policy";

const selection = {
  id: true,
  workflowStatus: true,
  workflowRevision: true,
  inviteToken: true,
  invitedAt: true,
  candidate: { select: { id: true, name: true, email: true } },
  attempt: { select: { id: true, status: true, submittedAt: true, scoreSum: true } },
} satisfies Prisma.InterviewSelect;

@Injectable()
export class CandidateStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(positionId: string, reviewer: Reviewer) {
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });
    if (!position) throw new NotFoundException("Position not found");
    const rows = await this.prisma.interview.findMany({
      where: { positionId },
      select: selection,
      orderBy: [{ invitedAt: "desc" }, { id: "asc" }],
    });
    const counts = Object.fromEntries(WORKFLOW_STATUSES.map((status) => [status, 0])) as Record<WorkflowStatus, number>;
    const interviews = rows.map((row) => {
      counts[row.workflowStatus] += 1;
      return {
        ...row,
        user: row.candidate,
        stage: row.workflowStatus,
        stageRevision: row.workflowRevision,
        allowedTransitions: allowedTransitions(row.workflowStatus),
      };
    });
    return { stages: WORKFLOW_STATUSES, counts, candidates: interviews, reviewer };
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
