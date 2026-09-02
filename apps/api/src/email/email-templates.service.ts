import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from "./email-template.dto";

export type EmailTemplateResponse = {
  id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  listTemplates(): Promise<EmailTemplateResponse[]> {
    return this.prisma.emailTemplate.findMany({
      orderBy: { name: "asc" },
    });
  }

  createTemplate(dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        key: dto.key.trim(),
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        html: dto.html,
        text: dto.text?.trim() || null,
      },
    });
  }

  async updateTemplate(templateId: string, dto: UpdateEmailTemplateDto) {
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
      },
    });
  }

  async deleteTemplate(templateId: string) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id: templateId },
      include: { _count: { select: { steps: true, tasks: true } } },
    });
    if (!existing) {
      throw new NotFoundException("Email template not found");
    }
    if (existing._count.steps > 0 || existing._count.tasks > 0) {
      throw new ConflictException("This template is used by one or more email sequences or queued tasks");
    }

    await this.prisma.emailTemplate.delete({ where: { id: templateId } });
    return { id: templateId };
  }
}
