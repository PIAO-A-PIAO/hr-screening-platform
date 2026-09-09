import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateStagesService } from './candidate-stages.service';
import { CandidateStagesController } from './candidate-stages.controller';
import { ReviewerAuth } from './reviewer-auth';
import { allowedTransitions, effectiveStage } from './stage-policy';

describe('candidate stage policy', () => {
  it('derives workflow stages from an invitation and attempt', () => {
    expect(effectiveStage({ candidateStage: null, inviteToken: null, attempt: null })).toBe('NOT_INVITED');
    expect(effectiveStage({ candidateStage: null, inviteToken: 'token', attempt: null })).toBe('INVITED');
    expect(effectiveStage({ candidateStage: null, inviteToken: 'token', attempt: { status: 'IN_PROGRESS' } })).toBe('IN_PROGRESS');
    expect(effectiveStage({ candidateStage: null, inviteToken: 'token', attempt: { status: 'SUBMITTED' } })).toBe('TO_BE_EVALUATED');
  });
  it('keeps a reviewer decision even if an attempt later submits', () => {
    expect(effectiveStage({ candidateStage: 'DISCARDED', inviteToken: 'token', attempt: { status: 'SUBMITTED' } })).toBe('DISCARDED');
  });
  it('requires submission before entering review stages from hold', () => {
    expect(allowedTransitions('ON_HOLD', null)).not.toContain('STAGE_1');
    expect(allowedTransitions('ON_HOLD', 'SUBMITTED')).toContain('STAGE_1');
    expect(allowedTransitions('ON_HOLD', 'SUBMITTED')).not.toContain('INVITED');
  });
  it('does not permit hiring an invited candidate or reopening terminal stages', () => {
    expect(allowedTransitions('INVITED', null)).not.toContain('HIRED');
    expect(allowedTransitions('HIRED', 'SUBMITTED')).toEqual([]);
    expect(allowedTransitions('DISCARDED', null)).toEqual([]);
    expect(allowedTransitions('WITHDRAWN', null)).toEqual([]);
  });
});

describe('temporary reviewer context', () => {
  it('uses one explicit placeholder identity until recruiter login is implemented', () => {
    expect(new ReviewerAuth().current()).toEqual({ id: 'temporary-reviewer', name: 'Temporary reviewer' });
  });
});

describe('candidate stage service', () => {
  const reviewer = { id: 'r1', name: 'Reviewer One' };
  function setup() {
    const row = { id: 'a1', candidateStage: null, stageRevision: 0, inviteToken: 'token',
      invitedAt: new Date(), user: { id: 'u1', name: 'Candidate', email: 'candidate@example.com' },
      attempt: { id: 'attempt1', status: 'SUBMITTED', submittedAt: new Date(), scoreSum: 0 } };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      userTestAssignment: { findFirst: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([row]) },
      candidateStageChange: { create: jest.fn().mockImplementation(async ({ data }: { data: object }) => data), findMany: jest.fn().mockResolvedValue([]) },
      emailTask: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      position: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
    };
    const prisma = { ...tx, $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
    return { tx, row, service: new CandidateStagesService(prisma as unknown as PrismaService) };
  }
  it('scopes candidates and counts to a position', async () => {
    const { service, tx } = setup();
    const result = await service.list('p1', reviewer);
    expect(tx.userTestAssignment.findMany.mock.calls[0][0].where).toEqual({ test: { positionId: 'p1' } });
    expect(result.counts.TO_BE_EVALUATED).toBe(1);
    expect(Object.values(result.counts).reduce((a, b) => a + b, 0)).toBe(1);
  });
  it('rejects an assignment from another position before modifying data', async () => {
    const { service, tx } = setup(); tx.userTestAssignment.findFirst.mockResolvedValue(null);
    await expect(service.change('other', 'a1', { stage: 'STAGE_1', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 0 }, reviewer)).rejects.toThrow(NotFoundException);
    expect(tx.userTestAssignment.update).not.toHaveBeenCalled();
  });
  it('writes the application and audit together without changing a global user', async () => {
    const { service, tx } = setup();
    const result = await service.change('p1', 'a1', { stage: 'STAGE_1', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 0 }, reviewer);
    expect(tx.userTestAssignment.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { candidateStage: 'STAGE_1', stageRevision: { increment: 1 } } });
    expect(result).toMatchObject({ assignmentId: 'a1', positionId: 'p1', actorId: 'r1', fromStage: 'TO_BE_EVALUATED', toStage: 'STAGE_1' });
    expect(tx.emailTask.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a stale reviewer update', async () => {
    const { service, tx } = setup();
    await expect(service.change('p1', 'a1', { stage: 'STAGE_1', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 1 }, reviewer)).rejects.toThrow(ConflictException);
    expect(tx.candidateStageChange.create).not.toHaveBeenCalled();
  });
  it('rejects a workflow stage that changed since the page loaded', async () => {
    const { service } = setup();
    await expect(service.change('p1', 'a1', { stage: 'DISCARDED', expectedStage: 'INVITED', expectedRevision: 0 }, reviewer)).rejects.toThrow(ConflictException);
  });
  it('rejects an invalid transition', async () => {
    const { service } = setup();
    await expect(service.change('p1', 'a1', { stage: 'HIRED', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 0 }, reviewer)).rejects.toThrow(BadRequestException);
  });
  it('cancels pending reminders only for the changed application', async () => {
    const { service, tx } = setup();
    await service.change('p1', 'a1', { stage: 'WITHDRAWN', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 0 }, reviewer);
    expect(tx.emailTask.updateMany.mock.calls[0][0].where).toEqual({ assignmentId: 'a1', status: 'PENDING' });
  });
  it('scopes history lookup before exposing audit records', async () => {
    const { service, tx } = setup(); tx.userTestAssignment.findFirst.mockResolvedValue(null);
    await expect(service.history('other', 'a1')).rejects.toThrow(NotFoundException);
    expect(tx.candidateStageChange.findMany).not.toHaveBeenCalled();
  });
  it('passes the temporary reviewer identity into controller stage changes', () => {
    const service = { change: jest.fn() };
    const auth = { current: jest.fn(() => reviewer) };
    const controller = new CandidateStagesController(service as unknown as CandidateStagesService, auth as unknown as ReviewerAuth);
    controller.change('p1', 'a1', { stage: 'STAGE_1', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 0 });
    expect(service.change).toHaveBeenCalledWith('p1', 'a1',
      { stage: 'STAGE_1', expectedStage: 'TO_BE_EVALUATED', expectedRevision: 0 }, reviewer);
  });
});
