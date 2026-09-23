import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, QuestionType, ResponseType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  QUESTION_VIDEO_MAX_BYTES,
  QUESTION_VIDEO_MIME_TYPES,
} from "../questions/question.constants";
import { QuestionStorageService } from "../questions/question-storage.service";
import { VideoTranscodingService } from "../questions/video-transcoding.service";
import { CreateResponseDto, UploadResponseVideoDto } from "./responses.dto";

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const responseInclude = {
  videoItem: { include: { asset: true } },
  multipleChoiceItem: {
    include: {
      selections: {
        include: { option: true },
        orderBy: { option: { order: "asc" as const } },
      },
    },
  },
  shortAnswerItem: true,
} satisfies Prisma.ResponseInclude;

type LoadedResponse = Prisma.ResponseGetPayload<{ include: typeof responseInclude }>;

@Injectable()
export class ResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: QuestionStorageService,
    private readonly transcoder: VideoTranscodingService,
  ) {}

  async createResponse(dto: CreateResponseDto, inviteToken?: string) {
    await this.authorizeAssignment(dto.userId, dto.testId, inviteToken);
    return this.persistResponse(dto, { updateExisting: false });
  }

  async saveResponseInAttempt(dto: CreateResponseDto, attemptId: string) {
    const attempt = await this.prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      testId: string;
      status: string;
    }>>(Prisma.sql`
      SELECT "id", "userId", "testId", "status"
      FROM "Attempt"
      WHERE "id" = ${attemptId}
      LIMIT 1
    `).then((rows) => rows[0] ?? null);

    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    if (attempt.status !== "IN_PROGRESS") {
      throw new ForbiddenException("Attempt is no longer editable");
    }
    if (attempt.userId !== dto.userId || attempt.testId !== dto.testId) {
      throw new ForbiddenException("Attempt does not match the candidate and test");
    }

    return this.persistResponse(dto, { attemptId, updateExisting: true });
  }

  private async persistResponse(
    dto: CreateResponseDto,
    options: { attemptId?: string; updateExisting: boolean },
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      include: {
        multipleChoiceItem: { include: { options: true } },
        shortAnswerItem: true,
      },
    });

    if (!question) {
      throw new NotFoundException("Question not found");
    }
    if (question.testId !== dto.testId) {
      throw new ForbiddenException("Question does not belong to the candidate's assigned test");
    }
    if (question.type !== (dto.type as unknown as QuestionType)) {
      throw new BadRequestException("response type does not match question type");
    }

    const duplicate = await this.prisma.response.findUnique({
      where: {
        candidateId_testId_questionId: {
          candidateId: dto.userId,
          testId: dto.testId,
          questionId: dto.questionId,
        },
      },
      select: { id: true },
    });

    if (duplicate && !options.updateExisting) {
      throw new ConflictException("A response already exists for this candidate and question");
    }

    const item = this.validateItem(dto.type, dto.item, question);

    try {
      const saved = duplicate
        ? await this.updateExistingResponse(duplicate.id, dto, item, options.attemptId)
        : await this.createNewResponse(dto, item, options.attemptId);

      return this.toResponse(saved);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A response already exists for this candidate and question");
      }
      throw error;
    }
  }

  private async createNewResponse(
    dto: CreateResponseDto,
    item: { selectedOptionIds?: string[]; textValue?: string },
    attemptId?: string,
  ) {
    return this.prisma.response.create({
      data: {
        type: dto.type,
        questionId: dto.questionId,
        candidateId: dto.userId,
        testId: dto.testId,
        attemptId,
        videoItem: dto.type === ResponseType.VIDEO ? { create: {} } : undefined,
        multipleChoiceItem: dto.type === ResponseType.MULTIPLE_CHOICE
          ? {
              create: {
                selections: {
                  create: (item.selectedOptionIds ?? []).map((optionId) => ({ optionId })),
                },
              },
            }
          : undefined,
        shortAnswerItem: dto.type === ResponseType.SHORT_ANSWER
          ? { create: { textValue: item.textValue ?? "" } }
          : undefined,
      },
      include: responseInclude,
    });
  }

  private async updateExistingResponse(
    responseId: string,
    dto: CreateResponseDto,
    item: { selectedOptionIds?: string[]; textValue?: string },
    attemptId?: string,
  ) {
    if (dto.type === ResponseType.VIDEO) {
      const updated = await this.prisma.response.update({
        where: { id: responseId },
        data: {
          attemptId,
          videoItem: {
            upsert: {
              create: {},
              update: {},
            },
          },
        },
        include: responseInclude,
      });
      return updated;
    }

    if (dto.type === ResponseType.MULTIPLE_CHOICE) {
      const updated = await this.prisma.response.update({
        where: { id: responseId },
        data: {
          attemptId,
          multipleChoiceItem: {
            upsert: {
              create: {
                selections: {
                  create: (item.selectedOptionIds ?? []).map((optionId) => ({ optionId })),
                },
              },
              update: {
                selections: {
                  deleteMany: {},
                  create: (item.selectedOptionIds ?? []).map((optionId) => ({ optionId })),
                },
              },
            },
          },
        },
        include: responseInclude,
      });
      return updated;
    }

    const updated = await this.prisma.response.update({
      where: { id: responseId },
      data: {
        attemptId,
        shortAnswerItem: {
          upsert: {
            create: { textValue: item.textValue ?? "" },
            update: { textValue: item.textValue ?? "" },
          },
        },
      },
      include: responseInclude,
    });
    return updated;
  }

  async getResponse(responseId: string, inviteToken?: string) {
    const response = await this.loadResponse(responseId);
    await this.authorizeAssignment(response.candidateId, response.testId, inviteToken);
    return this.toResponse(response);
  }

  async uploadVideo(
    responseId: string,
    file: UploadFile,
    dto: UploadResponseVideoDto,
    inviteToken?: string,
  ) {
    const response = await this.loadResponse(responseId);
    await this.authorizeAssignment(response.candidateId, response.testId, inviteToken);
    await this.assertResponseAttemptEditable(response);

    if (response.type !== ResponseType.VIDEO || !response.videoItem) {
      throw new BadRequestException("Response type must be VIDEO for video uploads");
    }
    this.validateVideo(file);

    const prepared = await this.transcoder.transcodeUpload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
    const buffer = prepared.preparedBuffer;
    const assetId = randomUUID();
    const storageKey = `responses/${responseId}/video/${assetId}`;
    const asset = await this.prisma.responseAsset.create({
      data: {
        id: assetId,
        storageKey,
        mimeType: prepared.preparedMimeType,
        size: prepared.preparedSize,
        durationSeconds: prepared.preparedDurationSeconds ?? dto.durationSeconds ?? null,
        checksum: createHash("sha256").update(buffer).digest("hex"),
        ownerId: response.candidateId,
        originalName: file.originalname,
      },
    });

    try {
      await this.storage.putObject(storageKey, buffer, prepared.preparedMimeType);
    } catch (error) {
      await this.prisma.responseAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
      throw error;
    }

    const previousAsset = response.videoItem.asset;
    try {
      await this.prisma.videoResponseItem.update({
        where: { responseId },
        data: { assetId: asset.id },
      });
    } catch (error) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      await this.prisma.responseAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
      throw error;
    }

    if (previousAsset && previousAsset.id !== asset.id) {
      await this.prisma.responseAsset.delete({ where: { id: previousAsset.id } }).catch(() => undefined);
      await this.storage.deleteObject(previousAsset.storageKey).catch(() => undefined);
    }

    return {
      assetId: asset.id,
      mimeType: asset.mimeType,
      size: asset.size,
      durationSeconds: asset.durationSeconds,
      checksum: asset.checksum,
      createdAt: asset.createdAt,
    };
  }

  private async assertResponseAttemptEditable(response: LoadedResponse) {
    if (!response.attemptId) {
      return;
    }

    const [attempt] = await this.prisma.$queryRaw<Array<{
      id: string;
      status: string;
    }>>(Prisma.sql`
      SELECT "id", "status"
      FROM "Attempt"
      WHERE "id" = ${response.attemptId}
      LIMIT 1
    `);

    if (attempt?.status === "SUBMITTED") {
      throw new ForbiddenException("Submitted attempts can no longer be modified");
    }
  }

  async openVideo(responseId: string, inviteToken?: string) {
    const response = await this.loadResponse(responseId);
    await this.authorizeAssignment(response.candidateId, response.testId, inviteToken);
    const asset = response.videoItem?.asset;

    if (response.type !== ResponseType.VIDEO || !asset) {
      throw new NotFoundException("Response video not found");
    }

    try {
      return {
        asset,
        file: await this.storage.openObject(asset.storageKey),
      };
    } catch {
      throw new NotFoundException("Response video not found");
    }
  }

  async openReviewerVideo(positionId: string, interviewId: string, responseId: string) {
    const match = await this.prisma.response.findFirst({
      where: {
        id: responseId,
        attempt: { interviewId, interview: { positionId } },
      },
      select: { id: true },
    });
    if (!match) throw new NotFoundException("Response video not found in this interview");
    const response = await this.loadResponse(responseId);
    const asset = response.videoItem?.asset;
    if (response.type !== ResponseType.VIDEO || !asset) {
      throw new NotFoundException("Response video not found");
    }
    try {
      return { asset, file: await this.storage.openObject(asset.storageKey) };
    } catch {
      throw new NotFoundException("Response video not found");
    }
  }

  private async authorizeAssignment(userId: string, testId: string, inviteToken?: string) {
    const assignment = await this.prisma.interview.findFirst({
      where: { candidateId: userId, testId },
      select: { inviteToken: true },
    });

    if (!assignment) {
      throw new ForbiddenException("Candidate is not assigned to this test");
    }
    if (!inviteToken || assignment.inviteToken !== inviteToken.trim()) {
      throw new ForbiddenException("A valid invite token is required");
    }
  }

  private async loadResponse(responseId: string): Promise<LoadedResponse> {
    const response = await this.prisma.response.findUnique({
      where: { id: responseId },
      include: responseInclude,
    });
    if (!response) {
      throw new NotFoundException("Response not found");
    }
    return response;
  }

  private validateItem(
    type: ResponseType,
    item: Record<string, unknown>,
    question: {
      multipleChoiceItem: {
        allowMultipleSelection: boolean;
        options: Array<{ id: string }>;
      } | null;
      shortAnswerItem: { maxLength: number | null } | null;
    },
  ) {
    if (type === ResponseType.VIDEO) {
      if (Object.keys(item).length > 0) {
        throw new BadRequestException("video response item must be empty before file upload");
      }
      return {} as { selectedOptionIds?: string[]; textValue?: string };
    }

    if (type === ResponseType.SHORT_ANSWER) {
      if (typeof item.textValue !== "string" || item.textValue.trim().length === 0) {
        throw new BadRequestException("short answer response requires textValue");
      }
      const textValue = item.textValue.trim();
      if (question.shortAnswerItem?.maxLength && textValue.length > question.shortAnswerItem.maxLength) {
        throw new BadRequestException("short answer exceeds the question's maximum length");
      }
      return { textValue };
    }

    if (!Array.isArray(item.selectedOptionIds) || item.selectedOptionIds.length === 0) {
      throw new BadRequestException("multiple choice response requires selectedOptionIds");
    }
    if (!item.selectedOptionIds.every((value) => typeof value === "string")) {
      throw new BadRequestException("selectedOptionIds must contain only strings");
    }
    const selectedOptionIds = [...new Set(item.selectedOptionIds as string[])];
    if (selectedOptionIds.length !== item.selectedOptionIds.length) {
      throw new BadRequestException("selectedOptionIds must be unique");
    }
    const allowedOptionIds = new Set(question.multipleChoiceItem?.options.map((option) => option.id) ?? []);
    if (selectedOptionIds.some((optionId) => !allowedOptionIds.has(optionId))) {
      throw new BadRequestException("selected option does not belong to this question");
    }
    if (!question.multipleChoiceItem?.allowMultipleSelection && selectedOptionIds.length !== 1) {
      throw new BadRequestException("this question accepts exactly one selected option");
    }
    return { selectedOptionIds };
  }

  private validateVideo(file: UploadFile) {
    if (!file) {
      throw new BadRequestException("file is required");
    }
    if (!QUESTION_VIDEO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported video file type: ${file.mimetype}`);
    }
    if (file.size > QUESTION_VIDEO_MAX_BYTES) {
      throw new BadRequestException(`Video file exceeds the ${QUESTION_VIDEO_MAX_BYTES} byte limit`);
    }
  }

  private toResponse(response: LoadedResponse) {
    return {
      id: response.id,
      type: response.type,
      questionId: response.questionId,
      userId: response.candidateId,
      testId: response.testId,
      attemptId: response.attemptId,
      score: response.score,
      evaluatorComment: response.evaluatorComment,
      evaluatorUserId: response.evaluatorUserId,
      evaluatedAt: response.evaluatedAt,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
      item: response.type === ResponseType.VIDEO
        ? {
            type: response.type,
            video: response.videoItem?.asset
              ? {
                  assetId: response.videoItem.asset.id,
                  mimeType: response.videoItem.asset.mimeType,
                  size: response.videoItem.asset.size,
                  durationSeconds: response.videoItem.asset.durationSeconds,
                  checksum: response.videoItem.asset.checksum,
                  createdAt: response.videoItem.asset.createdAt,
                }
              : null,
          }
        : response.type === ResponseType.MULTIPLE_CHOICE
          ? {
              type: response.type,
              selectedOptions: response.multipleChoiceItem?.selections.map(({ option }) => ({
                id: option.id,
                label: option.label,
                value: option.value,
                order: option.order,
              })) ?? [],
            }
          : {
              type: response.type,
              textValue: response.shortAnswerItem?.textValue ?? "",
            },
    };
  }
}
