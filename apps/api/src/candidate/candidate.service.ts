import { BadRequestException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { ApplicationStatus, QuestionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SaveAnswerDto } from "./dto";

@Injectable()
export class CandidateService {
  constructor(private readonly prisma: PrismaService) {}

  private async application(token: string) {
    const application = await this.prisma.application.findUnique({
      where: { inviteToken: token },
      include: {
        candidate: true,
        job: { include: { template: { include: { questions: { orderBy: { sortOrder: "asc" } } } } } },
        answers: true,
      },
    });
    if (!application) throw new NotFoundException("Interview link not found");
    if (application.expiresAt.getTime() < Date.now()) throw new GoneException("This interview link has expired");
    if (!application.job.template?.isPublished) throw new GoneException("This interview is not available");
    return application;
  }

  async getInterview(token: string) {
    const application = await this.application(token);
    if (application.status === ApplicationStatus.INVITED) {
      await this.prisma.application.update({ where: { id: application.id }, data: { status: ApplicationStatus.IN_PROGRESS } });
    }
    return application;
  }

  async saveAnswer(token: string, questionId: string, input: SaveAnswerDto) {
    const application = await this.application(token);
    if (application.submittedAt) throw new BadRequestException("This interview has already been submitted");
    const question = application.job.template?.questions.find((item) => item.id === questionId);
    if (!question) throw new NotFoundException("Question not found in this interview");
    if (question.type === QuestionType.VIDEO && !input.mediaUrl) throw new BadRequestException("A recording is required");
    if ((question.type === QuestionType.TEXT || question.type === QuestionType.FILL_BLANK) && !input.textValue?.trim()) {
      throw new BadRequestException("Enter an answer before saving");
    }
    if ((question.type === QuestionType.SINGLE_CHOICE || question.type === QuestionType.MULTI_SELECT) && !input.jsonValue?.length) {
      throw new BadRequestException("Select at least one option before saving");
    }

    return this.prisma.answer.upsert({
      where: { applicationId_questionId: { applicationId: application.id, questionId } },
      create: {
        applicationId: application.id,
        questionId,
        textValue: input.textValue,
        jsonValue: input.jsonValue ?? undefined,
        mediaUrl: input.mediaUrl,
        transcript: input.mediaUrl ? "Transcription pending — reviewer can correct this text." : null,
      },
      update: {
        textValue: input.textValue,
        jsonValue: input.jsonValue ?? undefined,
        mediaUrl: input.mediaUrl,
      },
    });
  }

  async submit(token: string) {
    const application = await this.application(token);
    const required = application.job.template?.questions.filter((question) => question.required) ?? [];
    const answered = new Set(application.answers.map((answer) => answer.questionId));
    const missing = required.filter((question) => !answered.has(question.id));
    if (missing.length) throw new BadRequestException(`Answer all required questions. ${missing.length} remaining.`);

    return this.prisma.application.update({
      where: { id: application.id },
      data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
    });
  }
}
