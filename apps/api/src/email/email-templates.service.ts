import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
}
