import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { QuestionAssetKind, QuestionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  QUESTION_THUMBNAIL_MAX_BYTES,
  QUESTION_THUMBNAIL_MIME_TYPES,
  QUESTION_VIDEO_MAX_BYTES,
  QUESTION_VIDEO_MIME_TYPES,
} from "./question.constants";
import { CreateQuestionDto } from "./create-question.dto";
import { QuestionStorageService } from "./question-storage.service";
import { UploadQuestionAssetDto } from "./upload-question-asset.dto";

type UploadedQuestionAsset = {
  assetId: string;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
  checksum: string;
  ownerId: string | null;
  createdAt: Date;
};

type QuestionResponse = {
  id: string;
  title: string;
  description: string | null;
  type: QuestionType;
  createdAt: Date;
  updatedAt: Date;
  item: Record<string, unknown>;
};

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type MultipleChoiceOptionInput = {
  label: string;
  value: string;
  order: number;
  isCorrect: boolean;
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: QuestionStorageService,
  ) {}

  async createQuestion(dto: CreateQuestionDto): Promise<QuestionResponse> {
    const item = this.validateQuestionItem(dto.type, dto.item) as {
      allowMultipleSelection?: boolean;
      shuffleOptions?: boolean;
      options?: MultipleChoiceOptionInput[];
      placeholder?: string | null;
      maxLength?: number | null;
      answerHint?: string | null;
    };

    const created = await this.prisma.question.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type,
        videoItem: dto.type === QuestionType.VIDEO ? { create: {} } : undefined,
        multipleChoiceItem: dto.type === QuestionType.MULTIPLE_CHOICE
          ? {
              create: {
                allowMultipleSelection: item.allowMultipleSelection ?? false,
                shuffleOptions: item.shuffleOptions ?? false,
                options: {
                  create: (item.options ?? []).map((option) => ({
                    label: option.label,
                    value: option.value,
                    order: option.order,
                    isCorrect: option.isCorrect,
                  })),
                },
              },
            }
          : undefined,
        shortAnswerItem: dto.type === QuestionType.SHORT_ANSWER
          ? {
              create: {
                placeholder: item.placeholder ?? null,
                maxLength: item.maxLength ?? null,
                answerHint: item.answerHint ?? null,
              },
            }
          : undefined,
      },
    });

    return this.getQuestion(created.id);
  }

  async getQuestion(questionId: string): Promise<QuestionResponse> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        videoItem: {
          include: {
            videoAsset: true,
            thumbnailAsset: true,
          },
        },
        multipleChoiceItem: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
        },
        shortAnswerItem: true,
      },
    });

    if (!question) {
      throw new NotFoundException("Question not found");
    }

    return this.toQuestionResponse(question);
  }

  async uploadVideo(questionId: string, file: UploadedFile, dto: UploadQuestionAssetDto) {
    return this.uploadAsset(questionId, QuestionAssetKind.VIDEO, file, dto);
  }

  async uploadThumbnail(questionId: string, file: UploadedFile, dto: UploadQuestionAssetDto) {
    return this.uploadAsset(questionId, QuestionAssetKind.THUMBNAIL, file, dto);
  }

  async getVideo(questionId: string) {
    return this.openAsset(questionId, QuestionAssetKind.VIDEO);
  }

  async getThumbnail(questionId: string) {
    return this.openAsset(questionId, QuestionAssetKind.THUMBNAIL);
  }

  private async uploadAsset(
    questionId: string,
    kind: QuestionAssetKind,
    file: UploadedFile,
    dto: UploadQuestionAssetDto,
  ): Promise<UploadedQuestionAsset> {
    this.validateUpload(kind, file);
    await this.getVideoQuestionOrThrow(questionId);

    const videoItem = await this.prisma.videoQuestionItem.upsert({
      where: { questionId },
      create: { questionId },
      update: {},
    });

    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const assetId = randomUUID();
    const storageKey = `questions/${questionId}/${kind.toLowerCase()}/${assetId}`;
    const existingAssetId = kind === QuestionAssetKind.VIDEO
      ? videoItem.videoAssetId
      : videoItem.thumbnailAssetId;

    const asset = await this.prisma.questionAsset.create({
      data: {
        id: assetId,
        kind,
        storageKey,
        mimeType: file.mimetype,
        size: file.size,
        durationSeconds: kind === QuestionAssetKind.VIDEO
          ? dto.durationSeconds ?? null
          : null,
        checksum,
        ownerId: dto.ownerId ?? null,
        originalName: file.originalname,
      },
    });

    try {
      await this.storage.putObject(storageKey, file.buffer, file.mimetype);
    } catch (error) {
      await this.prisma.questionAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
      throw error;
    }

    await this.prisma.videoQuestionItem.update({
      where: { questionId },
      data: kind === QuestionAssetKind.VIDEO
        ? { videoAssetId: asset.id }
        : { thumbnailAssetId: asset.id },
    });

    if (existingAssetId && existingAssetId !== asset.id) {
      const previousAsset = await this.prisma.questionAsset.findUnique({
        where: { id: existingAssetId },
      });
      await this.prisma.questionAsset.delete({ where: { id: existingAssetId } }).catch(() => undefined);
      if (previousAsset) {
        await this.storage.deleteObject(previousAsset.storageKey).catch(() => undefined);
      }
    }

    return this.toAssetResponse(asset);
  }

  private async openAsset(questionId: string, kind: QuestionAssetKind) {
    const question = await this.getVideoQuestionOrThrow(questionId);
    const videoItem = question.videoItem;
    const assetId = kind === QuestionAssetKind.VIDEO
      ? videoItem?.videoAssetId
      : videoItem?.thumbnailAssetId;

    if (!assetId) {
      throw new NotFoundException(
        kind === QuestionAssetKind.VIDEO
          ? "Question video not found"
          : "Question thumbnail not found",
      );
    }

    const asset = await this.prisma.questionAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset || asset.kind !== kind) {
      throw new NotFoundException(
        kind === QuestionAssetKind.VIDEO
          ? "Question video not found"
          : "Question thumbnail not found",
      );
    }

    let file;
    try {
      file = await this.storage.openObject(asset.storageKey);
    } catch {
      throw new NotFoundException(
        kind === QuestionAssetKind.VIDEO
          ? "Question video not found"
          : "Question thumbnail not found",
      );
    }
    return {
      asset: this.toAssetResponse(asset),
      file,
    };
  }

  private async getVideoQuestionOrThrow(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { videoItem: true },
    });

    if (!question) {
      throw new NotFoundException("Question not found");
    }

    if (question.type !== QuestionType.VIDEO) {
      throw new BadRequestException("Question type must be VIDEO for video assets");
    }

    return question;
  }

  private validateQuestionItem(type: QuestionType, item: Record<string, unknown>) {
    if (item === null || Array.isArray(item) || typeof item !== "object") {
      throw new BadRequestException("item must be an object");
    }

    const attachedType = typeof item.type === "string" ? item.type : undefined;
    if (attachedType && attachedType !== type) {
      throw new BadRequestException("question type does not match item type");
    }

    if (type === QuestionType.VIDEO) {
      const keys = Object.keys(item).filter((key) => key !== "type");
      if (keys.length > 0) {
        throw new BadRequestException("video question item does not accept extra fields");
      }
      return item;
    }

    if (type === QuestionType.MULTIPLE_CHOICE) {
      const options = item.options;
      if (!Array.isArray(options) || options.length === 0) {
        throw new BadRequestException("multiple choice question requires at least one option");
      }

      const normalizedOptions = options.map((option, index) => {
        if (option === null || typeof option !== "object" || Array.isArray(option)) {
          throw new BadRequestException(`option ${index + 1} must be an object`);
        }

        const optionRecord = option as Record<string, unknown>;
        if (typeof optionRecord.label !== "string" || optionRecord.label.trim().length === 0) {
          throw new BadRequestException(`option ${index + 1} requires a label`);
        }
        if (typeof optionRecord.value !== "string" || optionRecord.value.trim().length === 0) {
          throw new BadRequestException(`option ${index + 1} requires a value`);
        }
        if (typeof optionRecord.order !== "number" || !Number.isInteger(optionRecord.order)) {
          throw new BadRequestException(`option ${index + 1} requires an integer order`);
        }

        return {
          label: optionRecord.label,
          value: optionRecord.value,
          order: optionRecord.order,
          isCorrect: optionRecord.isCorrect === true,
        } satisfies MultipleChoiceOptionInput;
      });

      return {
        allowMultipleSelection: item.allowMultipleSelection === true,
        shuffleOptions: item.shuffleOptions === true,
        options: normalizedOptions,
      };
    }

    if (type === QuestionType.SHORT_ANSWER) {
      if ("placeholder" in item && item.placeholder !== undefined && typeof item.placeholder !== "string") {
        throw new BadRequestException("placeholder must be a string");
      }
      if ("answerHint" in item && item.answerHint !== undefined && typeof item.answerHint !== "string") {
        throw new BadRequestException("answerHint must be a string");
      }
      if ("maxLength" in item && item.maxLength !== undefined && !Number.isInteger(item.maxLength)) {
        throw new BadRequestException("maxLength must be an integer");
      }

      const keys = Object.keys(item).filter(
        (key) => key !== "type" && key !== "placeholder" && key !== "maxLength" && key !== "answerHint",
      );
      if (keys.length > 0) {
        throw new BadRequestException("short answer question item has unsupported fields");
      }

      return item;
    }

    throw new BadRequestException("unsupported question type");
  }

  private validateUpload(kind: QuestionAssetKind, file: UploadedFile) {
    if (!file) {
      throw new BadRequestException("file is required");
    }

    const allowedMimeTypes = kind === QuestionAssetKind.VIDEO
      ? QUESTION_VIDEO_MIME_TYPES
      : QUESTION_THUMBNAIL_MIME_TYPES;
    const maxBytes = kind === QuestionAssetKind.VIDEO
      ? QUESTION_VIDEO_MAX_BYTES
      : QUESTION_THUMBNAIL_MAX_BYTES;

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        kind === QuestionAssetKind.VIDEO
          ? `Unsupported video file type: ${file.mimetype}`
          : `Unsupported thumbnail file type: ${file.mimetype}`,
      );
    }

    if (file.size > maxBytes) {
      throw new BadRequestException(
        kind === QuestionAssetKind.VIDEO
          ? `Video file exceeds the ${QUESTION_VIDEO_MAX_BYTES} byte limit`
          : `Thumbnail file exceeds the ${QUESTION_THUMBNAIL_MAX_BYTES} byte limit`,
      );
    }
  }

  private toAssetResponse(asset: {
    id: string;
    mimeType: string;
    size: number;
    durationSeconds: number | null;
    checksum: string;
    ownerId: string | null;
    createdAt: Date;
  }): UploadedQuestionAsset {
    return {
      assetId: asset.id,
      mimeType: asset.mimeType,
      size: asset.size,
      durationSeconds: asset.durationSeconds,
      checksum: asset.checksum,
      ownerId: asset.ownerId,
      createdAt: asset.createdAt,
    };
  }

  private toQuestionResponse(question: {
    id: string;
    title: string;
    description: string | null;
    type: QuestionType;
    createdAt: Date;
    updatedAt: Date;
    videoItem: {
      videoAsset: {
        id: string;
        mimeType: string;
        size: number;
        durationSeconds: number | null;
        checksum: string;
        ownerId: string | null;
        createdAt: Date;
      } | null;
      thumbnailAsset: {
        id: string;
        mimeType: string;
        size: number;
        durationSeconds: number | null;
        checksum: string;
        ownerId: string | null;
        createdAt: Date;
      } | null;
    } | null;
    multipleChoiceItem: {
      allowMultipleSelection: boolean;
      shuffleOptions: boolean;
      options: Array<{
        id: string;
        label: string;
        value: string;
        order: number;
        isCorrect: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>;
    } | null;
    shortAnswerItem: {
      placeholder: string | null;
      maxLength: number | null;
      answerHint: string | null;
    } | null;
  }): QuestionResponse {
    if (question.type === QuestionType.VIDEO) {
      return {
        id: question.id,
        title: question.title,
        description: question.description,
        type: question.type,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        item: {
          type: question.type,
          video: question.videoItem?.videoAsset
            ? this.toPublicAsset(question.videoItem.videoAsset)
            : null,
          thumbnail: question.videoItem?.thumbnailAsset
            ? this.toPublicAsset(question.videoItem.thumbnailAsset)
            : null,
        },
      };
    }

    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      return {
        id: question.id,
        title: question.title,
        description: question.description,
        type: question.type,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        item: {
          type: question.type,
          allowMultipleSelection: question.multipleChoiceItem?.allowMultipleSelection ?? false,
          shuffleOptions: question.multipleChoiceItem?.shuffleOptions ?? false,
          options: (question.multipleChoiceItem?.options ?? []).map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
            order: option.order,
            isCorrect: option.isCorrect,
          })),
        },
      };
    }

    return {
      id: question.id,
      title: question.title,
      description: question.description,
      type: question.type,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      item: {
        type: question.type,
        placeholder: question.shortAnswerItem?.placeholder ?? null,
        maxLength: question.shortAnswerItem?.maxLength ?? null,
        answerHint: question.shortAnswerItem?.answerHint ?? null,
      },
    };
  }

  private toPublicAsset(asset: {
    id: string;
    mimeType: string;
    size: number;
    durationSeconds: number | null;
    checksum: string;
    ownerId: string | null;
    createdAt: Date;
  }) {
    return {
      assetId: asset.id,
      mimeType: asset.mimeType,
      size: asset.size,
      durationSeconds: asset.durationSeconds,
      checksum: asset.checksum,
      ownerId: asset.ownerId,
      createdAt: asset.createdAt,
    };
  }
}
