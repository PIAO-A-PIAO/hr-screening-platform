import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from "./email-template.dto";

export type EmailTemplateResponse = {
  id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

// These are deliberately finite: invalid tokens fail at authoring time rather
// than becoming empty strings when a candidate is contacted.
const supportedPlaceholders = new Set([
  "firstName", "lastName", "candidate.id", "candidate.name", "candidate.firstName", "candidate.lastName", "candidate.email",
  "assignment.id", "assignment.inviteToken", "assignment.invitedAt", "test.id", "test.name",
  "position.id", "position.title", "position.status", "inviteUrl",
]);
const tokenPattern = /\{\{?\s*([A-Za-z0-9_.-]+)\s*\}?\}/g;
function validateTemplateTokens(...values: Array<string | undefined>) {
  const invalid = new Set<string>();
  for (const value of values) for (const match of value?.matchAll(tokenPattern) ?? []) if (!supportedPlaceholders.has(match[1])) invalid.add(match[1]);
  if (invalid.size) throw new BadRequestException(`Unsupported placeholder${invalid.size > 1 ? "s" : ""}: ${[...invalid].join(", ")}`);
}
function normalizeTags(tags: string[] | undefined) { return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))]; }

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  listTemplates(): Promise<EmailTemplateResponse[]> {
    return this.prisma.emailTemplate.findMany({
      orderBy: { name: "asc" },
    });
  }

  createTemplate(dto: CreateEmailTemplateDto) {
    validateTemplateTokens(dto.subject, dto.html, dto.text);
    return this.prisma.emailTemplate.create({
      data: {
        key: dto.key.trim(),
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        html: dto.html,
        text: dto.text?.trim() || null,
        tags: normalizeTags(dto.tags),
      },
    });
  }

  async updateTemplate(templateId: string, dto: UpdateEmailTemplateDto) {
    validateTemplateTokens(dto.subject, dto.html, dto.text);
    const existing = await this.prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!existing) {
      throw new NotFoundException("Email template not found");
    }

    return this.prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        html: dto.html,
        text: dto.text?.trim() || null,
        ...(dto.tags === undefined ? {} : { tags: normalizeTags(dto.tags) }),
      },
    });
  }

  async deleteTemplate(templateId: string) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException("Email template not found");
    }

    const [stepCountRow] = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSequenceStep"
      WHERE "templateId" = ${templateId}
    `);

    if ((stepCountRow?.count ?? 0n) > 0n) {
      throw new ConflictException("This template is used by one or more email sequences");
    }

    await this.prisma.emailTemplate.delete({ where: { id: templateId } });
    return { id: templateId };
  }
}
