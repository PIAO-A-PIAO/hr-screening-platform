import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, QuestionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateQuestionDto } from "./dto";

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async addQuestion(jobId: string, input: CreateQuestionDto) {
    const template = await this.prisma.interviewTemplate.findUnique({
      where: { jobId },
    });
    if (!template) throw new NotFoundException("Interview template not found");
    const isChoiceQuestion = input.type === QuestionType.SINGLE_CHOICE || input.type === QuestionType.MULTI_SELECT;
    if (isChoiceQuestion && (input.options?.length ?? 0) < 2) {
      throw new BadRequestException("Choice questions need at least two options");
    }
    if (input.type === QuestionType.VIDEO && !input.answerSeconds) {
      throw new BadRequestException("Video questions need an answer time limit");
    }
    const lastQuestion = await this.prisma.question.findFirst({
      where: { templateId: template.id },
      orderBy: { sortOrder: "desc" },
    });
    return this.prisma.question.create({
      data: {
        ...input,
        promptMediaUrl: input.promptMediaUrl || null,
        options: input.options ?? undefined,
        templateId: template.id,
        sortOrder: (lastQuestion?.sortOrder ?? -1) + 1,
      },
    });
  }

  async removeQuestion(jobId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({ where: { id: questionId, template: { jobId } } });
    if (!question) throw new NotFoundException("Question not found");
    await this.prisma.question.delete({ where: { id: questionId } });
    return { deleted: true };
  }

  async publish(jobId: string) {
    const template = await this.prisma.interviewTemplate.findUnique({ where: { jobId }, include: { questions: true } });
    if (!template) throw new NotFoundException("Interview template not found");
    if (!template.questions.length) throw new BadRequestException("Add at least one question before publishing");
    await this.prisma.$transaction([
      this.prisma.interviewTemplate.update({ where: { id: template.id }, data: { isPublished: true } }),
      this.prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.OPEN } }),
    ]);
    return { published: true };
  }
}
