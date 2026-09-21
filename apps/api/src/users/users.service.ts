import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InterviewWorkflowStatus, UserRole, UserTestStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { GenerateUsersDto, InviteUsersDto, UserRoleDto, UserSeedDto, UserStatusDto } from "./users.dto";

type AssignmentRow = {
  id: string; userId: string; testId: string; status: UserStatusDto[]; inviteToken: string | null;
  invitedAt: Date; inviteExpiresAt: Date | null; createdAt: Date; updatedAt: Date;
};
export type UserResponse = {
  id: string; firstName: string; lastName: string; email: string; role: UserRoleDto; status: UserStatusDto[];
  createdAt: Date; updatedAt: Date; assignments: AssignmentRow[];
};

function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
function combineName(first: string, last: string) { return `${first.trim()} ${last.trim()}`.trim(); }
function splitName(value: string) { const [firstName = "", ...rest] = value.trim().split(/\s+/); return { firstName, lastName: rest.join(" ") }; }
function normalizeSeed(input: UserSeedDto & { testIds?: string[] }) {
  return { name: combineName(input.firstName, input.lastName), email: normalizeEmail(input.email), role: input.role ?? UserRoleDto.CANDIDATE, status: [...new Set(input.status ?? [])], testIds: [...new Set(input.testIds ?? [])] };
}
function workflowToLegacy(status: InterviewWorkflowStatus): UserStatusDto {
  if (status === "TO_EVALUATE") return UserStatusDto.TO_BE_EVALUATED;
  if (status === "PHASE_1") return UserStatusDto.STAGE_1;
  if (status === "PHASE_2") return UserStatusDto.STAGE_2;
  if (status === "PHASE_3") return UserStatusDto.STAGE_3;
  return status as UserStatusDto;
}
function legacyToWorkflow(statuses: UserStatusDto[]): InterviewWorkflowStatus {
  if (statuses.includes(UserStatusDto.DISCARDED)) return InterviewWorkflowStatus.DISCARDED;
  if (statuses.some((status) => [UserStatusDto.SHORTLISTED, UserStatusDto.HIRED, UserStatusDto.STAGE_3].includes(status))) return InterviewWorkflowStatus.PHASE_3;
  if (statuses.includes(UserStatusDto.STAGE_2)) return InterviewWorkflowStatus.PHASE_2;
  if (statuses.includes(UserStatusDto.STAGE_1)) return InterviewWorkflowStatus.PHASE_1;
  if (statuses.includes(UserStatusDto.TO_BE_EVALUATED)) return InterviewWorkflowStatus.TO_EVALUATE;
  return InterviewWorkflowStatus.INVITED;
}
function assignmentResponse(interview: { id: string; candidateId: string; testId: string; workflowStatus: InterviewWorkflowStatus; inviteToken: string | null; invitedAt: Date; inviteExpiresAt: Date | null; createdAt: Date; updatedAt: Date }): AssignmentRow {
  return { id: interview.id, userId: interview.candidateId, testId: interview.testId, status: [workflowToLegacy(interview.workflowStatus)], inviteToken: interview.inviteToken, invitedAt: interview.invitedAt, inviteExpiresAt: interview.inviteExpiresAt, createdAt: interview.createdAt, updatedAt: interview.updatedAt };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  async listUsers(role?: UserRoleDto): Promise<UserResponse[]> {
    const includeRecruiters = !role || role === UserRoleDto.RECRUITER;
    const includeCandidates = !role || role === UserRoleDto.CANDIDATE;
    const [recruiters, candidates] = await Promise.all([
      includeRecruiters ? this.prisma.user.findMany({ where: { role: UserRole.RECRUITER }, orderBy: { createdAt: "desc" } }) : [],
      includeCandidates ? this.prisma.candidate.findMany({ include: { interviews: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } }) : [],
    ]);
    return [
      ...recruiters.map((user) => ({ id: user.id, ...splitName(user.name), email: user.email, role: UserRoleDto.RECRUITER, status: user.status as UserStatusDto[], createdAt: user.createdAt, updatedAt: user.updatedAt, assignments: [] })),
      ...candidates.map((candidate) => ({ id: candidate.id, ...splitName(candidate.name), email: candidate.email, role: UserRoleDto.CANDIDATE, status: [...new Set(candidate.interviews.map((item) => workflowToLegacy(item.workflowStatus)))], createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, assignments: candidate.interviews.map(assignmentResponse) })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async generateUsers(dto: GenerateUsersDto): Promise<UserResponse[]> {
    const seeds = dto.users.map(normalizeSeed); this.assertUniqueEmails(seeds.map((seed) => seed.email));
    return this.prisma.$transaction(async (tx) => {
      const results: UserResponse[] = [];
      for (const seed of seeds) {
        if (seed.role === UserRoleDto.CANDIDATE) {
          const existing = await tx.candidate.findUnique({ where: { email: seed.email } });
          if (existing) throw new ConflictException("Email already exists");
          const candidate = await tx.candidate.create({ data: { name: seed.name, email: seed.email } });
          results.push({ id: candidate.id, ...splitName(candidate.name), email: candidate.email, role: UserRoleDto.CANDIDATE, status: seed.status.length ? seed.status : [UserStatusDto.NOT_INVITED], createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, assignments: [] });
        } else {
          const existing = await tx.user.findUnique({ where: { email: seed.email } });
          if (existing) throw new ConflictException("Email already exists");
          const user = await tx.user.create({ data: { name: seed.name, email: seed.email, role: UserRole.RECRUITER, status: seed.status as UserTestStatus[] } });
          results.push({ id: user.id, ...splitName(user.name), email: user.email, role: UserRoleDto.RECRUITER, status: user.status as UserStatusDto[], createdAt: user.createdAt, updatedAt: user.updatedAt, assignments: [] });
        }
      }
      return results;
    });
  }

  async inviteUsers(dto: InviteUsersDto): Promise<UserResponse[]> {
    const seeds = dto.users.map(normalizeSeed); this.assertUniqueEmails(seeds.map((seed) => seed.email));
    return this.prisma.$transaction(async (tx) => {
      const results: UserResponse[] = [];
      for (const seed of seeds) {
        if (seed.role === UserRoleDto.RECRUITER) throw new BadRequestException("Only candidates can be invited to interviews");
        const candidate = await tx.candidate.upsert({ where: { email: seed.email }, create: { name: seed.name, email: seed.email }, update: { name: seed.name } });
        const tests = seed.testIds.length ? await tx.test.findMany({ where: { id: { in: seed.testIds } }, select: { id: true, positionId: true } }) : [];
        if (tests.length !== seed.testIds.length) throw new NotFoundException("One or more tests were not found");
        if (tests.some((test) => !test.positionId)) throw new BadRequestException("Every invited test must be attached to a position");
        const assignments: AssignmentRow[] = [];
        for (const test of tests) {
          const inviteToken = randomUUID(); const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const interview = await tx.interview.upsert({
            where: { candidateId_positionId: { candidateId: candidate.id, positionId: test.positionId! } },
            create: { candidateId: candidate.id, positionId: test.positionId!, testId: test.id, workflowStatus: InterviewWorkflowStatus.INVITED, inviteToken, inviteExpiresAt },
            update: { testId: test.id, workflowStatus: InterviewWorkflowStatus.INVITED, inviteToken, invitedAt: new Date(), inviteExpiresAt },
          });
          assignments.push(assignmentResponse(interview));
          await this.email.queueInvitationEmail(tx, { assignmentId: interview.id });
        }
        results.push({ id: candidate.id, ...splitName(candidate.name), email: candidate.email, role: UserRoleDto.CANDIDATE, status: assignments.length ? [UserStatusDto.INVITED] : [UserStatusDto.NOT_INVITED], createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, assignments });
      }
      return results;
    });
  }

  async getUser(userId: string, inviteToken?: string): Promise<UserResponse> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: userId }, include: { interviews: { orderBy: { createdAt: "desc" } } } });
    if (candidate) {
      const token = inviteToken?.trim();
      if (!token || !candidate.interviews.some((item) => item.inviteToken === token && (!item.inviteExpiresAt || item.inviteExpiresAt.getTime() > Date.now()))) throw new ForbiddenException("An invite token is required to view this candidate");
      const assignments = candidate.interviews.map(assignmentResponse);
      return { id: candidate.id, ...splitName(candidate.name), email: candidate.email, role: UserRoleDto.CANDIDATE, status: assignments.map((item) => item.status[0]), createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, assignments };
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return { id: user.id, ...splitName(user.name), email: user.email, role: UserRoleDto.RECRUITER, status: user.status as UserStatusDto[], createdAt: user.createdAt, updatedAt: user.updatedAt, assignments: [] };
  }

  async updateUserStatus(userId: string, status: UserStatusDto[]): Promise<UserResponse> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: userId } });
    if (candidate) {
      await this.prisma.interview.updateMany({ where: { candidateId: userId }, data: { workflowStatus: legacyToWorkflow(status), workflowRevision: { increment: 1 } } });
      const interviews = await this.prisma.interview.findMany({ where: { candidateId: userId }, orderBy: { createdAt: "desc" } });
      return { id: candidate.id, ...splitName(candidate.name), email: candidate.email, role: UserRoleDto.CANDIDATE, status, createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, assignments: interviews.map(assignmentResponse) };
    }
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException("User not found");
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: status as UserTestStatus[] } });
    return { id: user.id, ...splitName(user.name), email: user.email, role: UserRoleDto.RECRUITER, status: user.status as UserStatusDto[], createdAt: user.createdAt, updatedAt: user.updatedAt, assignments: [] };
  }

  async deleteUser(userId: string): Promise<{ id: string }> {
    const deletedCandidate = await this.prisma.candidate.deleteMany({ where: { id: userId } });
    if (deletedCandidate.count) return { id: userId };
    const deletedUser = await this.prisma.user.deleteMany({ where: { id: userId } });
    if (!deletedUser.count) throw new NotFoundException("User not found");
    return { id: userId };
  }

  private assertUniqueEmails(emails: string[]) { if (new Set(emails).size !== emails.length) throw new BadRequestException("email values must be unique within the request"); }
}
