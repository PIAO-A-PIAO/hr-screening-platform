import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  GenerateUsersDto,
  InviteUsersDto,
  UserRoleDto,
  UserSeedDto,
  UserStatusDto,
} from "./users.dto";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRoleDto;
  status: UserStatusDto[];
  createdAt: Date;
  updatedAt: Date;
};

type AssignmentRow = {
  id: string;
  userId: string;
  testId: string;
  status: UserStatusDto[];
  inviteToken: string | null;
  invitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserResponse = UserRow & {
  assignments: AssignmentRow[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeStatuses(status?: UserStatusDto[]) {
  return [...new Set(status ?? [])];
}

function combineName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function splitLegacyName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function enumArraySql(values: string[], enumName: string) {
  const enumType = Prisma.raw(`"${enumName}"[]`);
  if (values.length === 0) {
    return Prisma.sql`CAST(ARRAY[] AS ${enumType})`;
  }

  return Prisma.sql`CAST(ARRAY[${Prisma.join(values.map((value) => Prisma.sql`${value}`))}] AS ${enumType})`;
}

function normalizeSeed(input: UserSeedDto & { testIds?: string[] }) {
  const role = input.role ?? UserRoleDto.CANDIDATE;
  const status = normalizeStatuses(
    input.status ?? (role === UserRoleDto.CANDIDATE ? [UserStatusDto.NOT_INVITED] : []),
  );

  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: normalizeEmail(input.email),
    role,
    status,
    testIds: [...new Set(input.testIds ?? [])],
  };
}

function rowToResponse(row: UserRow, assignments: AssignmentRow[] = []): UserResponse {
  return {
    ...row,
    assignments,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  private assignmentInviteTokenSupportPromise: Promise<boolean> | null = null;
  private assignmentInvitedAtSupportPromise: Promise<boolean> | null = null;
  private userNamePartsSupportPromise: Promise<boolean> | null = null;

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

  private supportsAssignmentInvitedAt() {
    this.assignmentInvitedAtSupportPromise ??= this.prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'UserTestAssignment'
          AND column_name = 'invitedAt'
      ) AS "exists"
    `).then((rows) => rows[0]?.exists === true);

    return this.assignmentInvitedAtSupportPromise;
  }

  private supportsUserNameParts() {
    this.userNamePartsSupportPromise ??= this.prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      SELECT "column_name"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'User'
        AND column_name IN ('firstName', 'lastName')
    `).then((rows) => rows.length === 2);

    return this.userNamePartsSupportPromise;
  }

  async listUsers(role?: UserRoleDto): Promise<UserResponse[]> {
    const supportsInviteToken = await this.supportsAssignmentInviteToken();
    const supportsInvitedAt = await this.supportsAssignmentInvitedAt();
    const users = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        email: string;
        role: UserRoleDto;
        status: UserStatusDto[];
        createdAt: Date;
        updatedAt: Date;
      }>
    >(role
      ? Prisma.sql`
        SELECT "id", "name", "email", "role", "status", "createdAt", "updatedAt"
        FROM "User"
        WHERE "role" = ${role}::"UserRole"
        ORDER BY "createdAt" DESC
      `
      : Prisma.sql`
        SELECT "id", "name", "email", "role", "status", "createdAt", "updatedAt"
        FROM "User"
        ORDER BY "createdAt" DESC
      `,
    ).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        ...splitLegacyName(row.name),
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );

    const assignments = supportsInviteToken && supportsInvitedAt
      ? await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
        SELECT
          "id",
          "userId",
          "testId",
          "status",
          "inviteToken",
          "invitedAt",
          "createdAt",
          "updatedAt"
        FROM "UserTestAssignment"
        ORDER BY "createdAt" DESC
      `)
      : supportsInviteToken
        ? await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
          SELECT
            "id",
            "userId",
            "testId",
            "status",
            "inviteToken",
            "createdAt",
            "updatedAt"
          FROM "UserTestAssignment"
          ORDER BY "createdAt" DESC
        `).then((rows) =>
          rows.map((row) => ({
            ...row,
            invitedAt: row.createdAt,
          })),
        )
        : supportsInvitedAt
          ? await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
            SELECT
              "id",
              "userId",
              "testId",
              "status",
              "invitedAt",
              "createdAt",
              "updatedAt"
            FROM "UserTestAssignment"
            ORDER BY "createdAt" DESC
          `).then((rows) =>
            rows.map((row) => ({
              ...row,
              inviteToken: null,
            })),
          )
          : await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
            SELECT
              "id",
              "userId",
              "testId",
              "status",
              "createdAt",
              "updatedAt"
            FROM "UserTestAssignment"
            ORDER BY "createdAt" DESC
          `).then((rows) =>
            rows.map((row) => ({
              ...row,
              inviteToken: null,
              invitedAt: row.createdAt,
            })),
          );

    const assignmentsByUserId = new Map<string, AssignmentRow[]>();
    for (const assignment of assignments) {
      const bucket = assignmentsByUserId.get(assignment.userId) ?? [];
      bucket.push(assignment);
      assignmentsByUserId.set(assignment.userId, bucket);
    }

    return users.map((user) => rowToResponse(user, assignmentsByUserId.get(user.id) ?? []));
  }

  async generateUsers(dto: GenerateUsersDto): Promise<UserResponse[]> {
    const normalized = dto.users.map((user) => normalizeSeed(user));
    this.assertNoDuplicateEmails(normalized.map((user) => user.email));

    return this.prisma.$transaction(async (tx) => {
      const results: UserResponse[] = [];

      for (const user of normalized) {
        const inserted = await this.insertUser(tx, user, { conflictMessage: "Email already exists" });
        results.push(inserted);
      }

      return results;
    });
  }

  async inviteUsers(dto: InviteUsersDto): Promise<UserResponse[]> {
    const normalized = dto.users.map((user) => normalizeSeed(user));
    this.assertNoDuplicateEmails(normalized.map((user) => user.email));

    return this.prisma.$transaction(async (tx) => {
      const results: UserResponse[] = [];

      for (const user of normalized) {
        const saved = await this.upsertUser(tx, {
          ...user,
          status: normalizeStatuses([UserStatusDto.INVITED, ...user.status]),
        });

        const assignments = await this.upsertAssignments(tx, saved.id, user.testIds, user.status);
        results.push({
          ...saved,
          assignments,
        });
      }

      return results;
    });
  }

  async getUser(userId: string, inviteToken?: string): Promise<UserResponse> {
    const supportsInviteToken = await this.supportsAssignmentInviteToken();
    const response = await this.loadUserResponse(userId, supportsInviteToken);

    if (response.user.role === UserRoleDto.CANDIDATE && supportsInviteToken) {
      const authorized = typeof inviteToken === "string" && inviteToken.trim().length > 0
        && response.assignments.some((assignment) => assignment.inviteToken === inviteToken.trim());

      if (!authorized) {
        throw new ForbiddenException("An invite token is required to view this candidate");
      }
    }

    return rowToResponse(response.user, response.assignments);
  }

  async updateUserStatus(userId: string, status: UserStatusDto[]): Promise<UserResponse> {
    const supportsInviteToken = await this.supportsAssignmentInviteToken();

    const [updatedUser] = await this.prisma.$queryRaw<UserRow[]>(Prisma.sql`
      UPDATE "User"
      SET "status" = ${enumArraySql(normalizeStatuses(status), "UserTestStatus")},
          "updatedAt" = NOW()
      WHERE "id" = ${userId}
      RETURNING "id", "name", "email", "role", "status", "createdAt", "updatedAt"
    `);

    if (!updatedUser) {
      throw new NotFoundException("User not found");
    }

    const response = await this.loadUserResponse(userId, supportsInviteToken);
    return rowToResponse(response.user, response.assignments);
  }

  async deleteUser(userId: string): Promise<{ id: string }> {
    const [deleted] = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      DELETE FROM "User"
      WHERE "id" = ${userId}
      RETURNING "id"
    `);

    if (!deleted) {
      throw new NotFoundException("User not found");
    }

    return deleted;
  }

  private assertNoDuplicateEmails(emails: string[]) {
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      throw new BadRequestException("email values must be unique within the request");
    }
  }

  private async insertUser(
    tx: Prisma.TransactionClient,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      role: UserRoleDto;
      status: UserStatusDto[];
    },
    options?: { conflictMessage?: string },
  ): Promise<UserResponse> {
    const [record] = await tx.$queryRaw<Array<{
      id: string;
      name: string;
      email: string;
      role: UserRoleDto;
      status: UserStatusDto[];
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      INSERT INTO "User" ("id", "name", "email", "role", "status", "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()},
        ${combineName(input.firstName, input.lastName)},
        ${input.email},
        ${input.role}::"UserRole",
        ${enumArraySql(input.status, "UserTestStatus")},
        NOW(),
        NOW()
      )
      ON CONFLICT ("email") DO NOTHING
      RETURNING "id", "name", "email", "role", "status", "createdAt", "updatedAt"
    `).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        ...splitLegacyName(row.name),
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );

    if (!record) {
      throw new ConflictException(options?.conflictMessage ?? "Email already exists");
    }

    return rowToResponse(record);
  }

  private async loadUserResponse(userId: string, supportsInviteToken: boolean) {
    const supportsInvitedAt = await this.supportsAssignmentInvitedAt();
    const [user] = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      email: string;
      role: UserRoleDto;
      status: UserStatusDto[];
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      SELECT "id", "name", "email", "role", "status", "createdAt", "updatedAt"
      FROM "User"
      WHERE "id" = ${userId}
      LIMIT 1
    `).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        ...splitLegacyName(row.name),
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const assignments = supportsInviteToken && supportsInvitedAt
      ? await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
        SELECT
          "id",
          "userId",
          "testId",
          "status",
          "inviteToken",
          "invitedAt",
          "createdAt",
          "updatedAt"
        FROM "UserTestAssignment"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
      `)
      : supportsInviteToken
        ? await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
          SELECT
            "id",
            "userId",
            "testId",
            "status",
            "inviteToken",
            "createdAt",
            "updatedAt"
          FROM "UserTestAssignment"
          WHERE "userId" = ${userId}
          ORDER BY "createdAt" DESC
        `).then((rows) =>
          rows.map((row) => ({
            ...row,
            invitedAt: row.createdAt,
          })),
        )
        : supportsInvitedAt
          ? await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
            SELECT
              "id",
              "userId",
              "testId",
              "status",
              "invitedAt",
              "createdAt",
              "updatedAt"
            FROM "UserTestAssignment"
            WHERE "userId" = ${userId}
            ORDER BY "createdAt" DESC
          `).then((rows) =>
            rows.map((row) => ({
              ...row,
              inviteToken: null,
            })),
          )
          : await this.prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
            SELECT
              "id",
              "userId",
              "testId",
              "status",
              "createdAt",
              "updatedAt"
            FROM "UserTestAssignment"
            WHERE "userId" = ${userId}
            ORDER BY "createdAt" DESC
          `).then((rows) =>
            rows.map((row) => ({
              ...row,
              inviteToken: null,
              invitedAt: row.createdAt,
            })),
          );

    return { user, assignments };
  }

  private async upsertUser(
    tx: Prisma.TransactionClient,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      role: UserRoleDto;
      status: UserStatusDto[];
    },
  ): Promise<UserResponse> {
    const [existing] = await tx.$queryRaw<Array<{
      id: string;
      name: string;
      email: string;
      role: UserRoleDto;
      status: UserStatusDto[];
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      SELECT "id", "name", "email", "role", "status", "createdAt", "updatedAt"
      FROM "User"
      WHERE "email" = ${input.email}
      LIMIT 1
    `).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        ...splitLegacyName(row.name),
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );

    if (!existing) {
      return this.insertUser(tx, input);
    }

    const mergedStatus = normalizeStatuses([...(existing.status ?? []), ...input.status]);
    const [record] = await tx.$queryRaw<Array<{
      id: string;
      name: string;
      email: string;
      role: UserRoleDto;
      status: UserStatusDto[];
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      UPDATE "User"
      SET "name" = ${combineName(input.firstName, input.lastName)},
          "role" = ${input.role}::"UserRole",
          "status" = ${enumArraySql(mergedStatus, "UserTestStatus")},
          "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
      RETURNING "id", "name", "email", "role", "status", "createdAt", "updatedAt"
    `).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        ...splitLegacyName(row.name),
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );

    if (!record) {
      throw new NotFoundException("User not found");
    }

    return rowToResponse(record);
  }

  private async upsertAssignments(
    tx: Prisma.TransactionClient,
    userId: string,
    testIds: string[],
    userStatuses: UserStatusDto[],
  ): Promise<AssignmentRow[]> {
    const uniqueTestIds = [...new Set(testIds)];
    if (uniqueTestIds.length === 0) {
      return [];
    }

    const existingTests = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Test"
      WHERE "id" IN (${Prisma.join(uniqueTestIds.map((testId) => Prisma.sql`${testId}`))})
    `);

    if (existingTests.length !== uniqueTestIds.length) {
      const existingIds = new Set(existingTests.map((test) => test.id));
      const missing = uniqueTestIds.filter((testId) => !existingIds.has(testId));
      throw new NotFoundException(`Test not found: ${missing.join(", ")}`);
    }

    const assignments: AssignmentRow[] = [];
    const assignmentStatuses = normalizeStatuses([UserStatusDto.INVITED, ...userStatuses]);
    const supportsInviteToken = await this.supportsAssignmentInviteToken();

    for (const testId of uniqueTestIds) {
      const inviteToken = randomUUID();
      const [existingAssignment] = supportsInviteToken
        ? await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
          SELECT
            "id",
            "userId",
            "testId",
            "status",
            "inviteToken",
            "invitedAt",
            "createdAt",
            "updatedAt"
          FROM "UserTestAssignment"
          WHERE "userId" = ${userId}
            AND "testId" = ${testId}
          LIMIT 1
        `)
        : await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
          SELECT
            "id",
            "userId",
            "testId",
            "status",
            "createdAt",
            "updatedAt"
          FROM "UserTestAssignment"
          WHERE "userId" = ${userId}
            AND "testId" = ${testId}
          LIMIT 1
        `).then((rows) =>
          rows.map((row) => ({
            ...row,
            inviteToken: null,
            invitedAt: row.createdAt,
          })),
        );

      if (!existingAssignment) {
        const [created] = supportsInviteToken
          ? await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
            INSERT INTO "UserTestAssignment" ("id", "userId", "testId", "status", "inviteToken", "invitedAt", "createdAt", "updatedAt")
            VALUES (
              ${randomUUID()},
              ${userId},
              ${testId},
              ${enumArraySql(assignmentStatuses, "UserTestStatus")},
              ${inviteToken},
              NOW(),
              NOW(),
              NOW()
            )
            RETURNING "id", "userId", "testId", "status", "inviteToken", "invitedAt", "createdAt", "updatedAt"
          `)
          : await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
            INSERT INTO "UserTestAssignment" ("id", "userId", "testId", "status", "createdAt", "updatedAt")
            VALUES (
              ${randomUUID()},
              ${userId},
              ${testId},
              ${enumArraySql(assignmentStatuses, "UserTestStatus")},
              NOW(),
              NOW()
            )
            RETURNING "id", "userId", "testId", "status", "createdAt", "updatedAt"
          `).then((rows) =>
            rows.map((row) => ({
              ...row,
              inviteToken: null,
              invitedAt: row.createdAt,
            })),
          );

        assignments.push(created);
        continue;
      }

      const mergedStatus = normalizeStatuses([...(existingAssignment.status ?? []), ...assignmentStatuses]);
      const [updated] = supportsInviteToken
        ? await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
          UPDATE "UserTestAssignment"
          SET "status" = ${enumArraySql(mergedStatus, "UserTestStatus")},
              "inviteToken" = COALESCE("inviteToken", ${inviteToken}),
              "invitedAt" = COALESCE("invitedAt", NOW()),
              "updatedAt" = NOW()
          WHERE "id" = ${existingAssignment.id}
          RETURNING "id", "userId", "testId", "status", "inviteToken", "invitedAt", "createdAt", "updatedAt"
        `)
        : await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
          UPDATE "UserTestAssignment"
          SET "status" = ${enumArraySql(mergedStatus, "UserTestStatus")},
              "updatedAt" = NOW()
          WHERE "id" = ${existingAssignment.id}
          RETURNING "id", "userId", "testId", "status", "createdAt", "updatedAt"
        `).then((rows) =>
          rows.map((row) => ({
            ...row,
            inviteToken: null,
            invitedAt: row.createdAt,
          })),
        );

      if (!updated) {
        throw new NotFoundException("User test assignment not found");
      }

      assignments.push(updated);
    }

    return assignments;
  }
}
