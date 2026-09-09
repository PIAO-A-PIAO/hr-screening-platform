import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CandidateStage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Reviewer } from './reviewer-auth';
import { allowedTransitions, effectiveStage, Stage, STAGES, TERMINAL_STAGES } from './stage-policy';

const selection = {
  id: true, candidateStage: true, stageRevision: true, inviteToken: true, invitedAt: true,
  user: { select: { id: true, name: true, email: true } },
  attempt: { select: { id: true, status: true, submittedAt: true, scoreSum: true } },
} satisfies Prisma.UserTestAssignmentSelect;

@Injectable()
export class CandidateStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(positionId: string, reviewer: Reviewer) {
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });
    if (!position) throw new NotFoundException('Position not found');
    const rows = await this.prisma.userTestAssignment.findMany({
      where: { test: { positionId } }, select: selection, orderBy: [{ invitedAt: 'desc' }, { id: 'asc' }],
    });
    const counts = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<Stage, number>;
    const candidates = rows.map((row) => {
      const stage = effectiveStage(row);
      counts[stage] += 1;
      return { ...row, stage, allowedTransitions: allowedTransitions(stage, row.attempt?.status ?? null) };
    });
    return { stages: STAGES, counts, candidates, reviewer };
  }

  async remove(positionId: string, assignmentId: string) {
    const result = await this.prisma.userTestAssignment.deleteMany({
      where: { id: assignmentId, test: { positionId } },
    });
    if (result.count !== 1) throw new NotFoundException('Candidate application not found in this position');
    return { id: assignmentId };
  }

  async history(positionId: string, assignmentId: string) {
    const assignment = await this.prisma.userTestAssignment.findFirst({ where: { id: assignmentId, test: { positionId } }, select: { id: true } });
    if (!assignment) throw new NotFoundException('Candidate application not found in this position');
    return this.prisma.candidateStageChange.findMany({
      where: { assignmentId, positionId }, orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async change(positionId: string, assignmentId: string, input: {
    stage: Stage; expectedStage: Stage; expectedRevision: number;
  }, reviewer: Reviewer) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize competing reviewer updates; IDs are scoped to this position before use.
      await tx.$queryRaw(Prisma.sql`
        SELECT a."id" FROM "UserTestAssignment" a
        JOIN "Test" t ON t."id" = a."testId"
        WHERE a."id" = ${assignmentId} AND t."positionId" = ${positionId}
        FOR UPDATE OF a
      `);
      const row = await tx.userTestAssignment.findFirst({
        where: { id: assignmentId, test: { positionId } }, select: selection,
      });
      if (!row) throw new NotFoundException('Candidate application not found in this position');
      const previous = effectiveStage(row);
      if (row.stageRevision !== input.expectedRevision || previous !== input.expectedStage) {
        throw new ConflictException('This candidate changed. Refresh and try again.');
      }
      if (!allowedTransitions(previous, row.attempt?.status ?? null).includes(input.stage)) {
        throw new BadRequestException(`Cannot move from ${previous} to ${input.stage}`);
      }
      // Workflow states are derived from Attempt, not manually frozen on the application.
      const stage = ['INVITED', 'IN_PROGRESS', 'TO_BE_EVALUATED'].includes(input.stage)
        ? null : input.stage as CandidateStage;
      await tx.userTestAssignment.update({
        where: { id: assignmentId }, data: { candidateStage: stage, stageRevision: { increment: 1 } },
      });
      const change = await tx.candidateStageChange.create({ data: {
        assignmentId, positionId, candidateId: row.user.id,
        fromStage: previous as CandidateStage, toStage: input.stage as CandidateStage,
        actorId: reviewer.id, actorName: reviewer.name,
      } });
      if (TERMINAL_STAGES.includes(input.stage)) {
        // Already in-flight SMTP delivery cannot be recalled. The worker also checks stage.
        await tx.emailTask.updateMany({ where: { assignmentId, status: 'PENDING' }, data: {
          status: 'CANCELLED', processedAt: new Date(), lastError: `Candidate stage: ${input.stage}`,
        } });
      }
      return change;
    });
  }
}
