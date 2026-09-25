import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, QuestionAssetKind, TestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QUESTION_VIDEO_MAX_BYTES, QUESTION_VIDEO_MIME_TYPES } from "../questions/question.constants";
import { QuestionStorageService } from "../questions/question-storage.service";
import { QuestionsService } from "../questions/questions.service";
import { AppendTestQuestionsDto, CreateTestDto, ReorderTestQuestionsDto } from "./create-test.dto";

export type TestQuestionResponse = Awaited<ReturnType<QuestionsService["getQuestion"]>> & {
  order: number;
};

export type TestResponse = {
  id: string;
  name: string;
  description: string | null;
  estimatedDurationMinutes: number | null;
  tags: string[];
  status: TestStatus;
  positionId: string | null;
  closing: { title: string; message: string; videoAvailable: boolean };
  createdAt: Date;
  updatedAt: Date;
  questions: TestQuestionResponse[];
};

export type TestSummaryResponse = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  status: TestStatus;
  positionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  questionCount: number;
};

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly storage: QuestionStorageService,
  ) {}

  private closingFrom(config: Prisma.JsonValue | null) {
    const root = config && typeof config === "object" && !Array.isArray(config) ? config as Record<string, unknown> : {};
    const closing = root.closing && typeof root.closing === "object" && !Array.isArray(root.closing) ? root.closing as Record<string, unknown> : {};
    return { root, title: typeof closing.title === "string" ? closing.title : "Thank you!",
      message: typeof closing.message === "string" ? closing.message : "Thank you for completing the interview. We will be in touch soon.",
      videoAssetId: typeof closing.videoAssetId === "string" ? closing.videoAssetId : null };
  }

  async listTests(): Promise<TestSummaryResponse[]> {
    const tests = await this.prisma.test.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    return tests.map((test) => ({
      id: test.id,
      name: test.name,
      description: test.description,
      tags: test.tags,
      status: test.status,
      positionId: test.positionId,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      questionCount: test._count.questions,
    }));
  }

  async createTest(dto: CreateTestDto): Promise<TestResponse> {
    const orders = dto.questions.map((question) => question.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new BadRequestException("question order values must be unique within a test");
    }

    const test = await this.prisma.$transaction(async (tx) => {
      if (dto.positionId) {
        const position = await tx.position.findUnique({
          where: { id: dto.positionId },
          select: {
            id: true,
            test: {
              select: { id: true },
            },
          },
        });

        if (!position) {
          throw new NotFoundException("Position not found");
        }

        if (position.test) {
          throw new BadRequestException("Position already has an attached test");
        }
      }

      const createdTest = await tx.test.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          tags: dto.tags ?? [],
          status: dto.status ?? TestStatus.DRAFT,
          positionId: dto.positionId ?? null,
          configuration: { estimatedDurationMinutes: dto.estimatedDurationMinutes ?? null,
            closing: { title: dto.closing?.title ?? "Thank you!", message: dto.closing?.message ?? "Thank you for completing the interview. We will be in touch soon." } },
        },
      });

      const sortedQuestions = [...dto.questions].sort((left, right) => left.order - right.order);
      for (const question of sortedQuestions) {
        await this.questions.createQuestionInTest(tx, question, createdTest.id, question.order);
      }

      return createdTest;
    });

    return this.getTest(test.id);
  }

  async updateTest(
    testId: string,
    dto: CreateTestDto,
  ): Promise<TestResponse> {
    const orders = dto.questions.map((question) => question.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new BadRequestException("question order values must be unique within a test");
    }

    const questionIds = dto.questions
      .map((question) => question.questionId)
      .filter((questionId): questionId is string => Boolean(questionId));
    const uniqueQuestionIds = new Set(questionIds);
    if (uniqueQuestionIds.size !== questionIds.length) {
      throw new BadRequestException("questionId values must be unique within a test");
    }

    const test = await this.prisma.$transaction(async (tx) => {
      const existingTest = await tx.test.findUnique({
        where: { id: testId },
        select: {
          id: true,
          positionId: true,
          configuration: true,
          questions: {
            select: {
              id: true,
              _count: { select: { responses: true } },
            },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!existingTest) {
        throw new NotFoundException("Test not found");
      }

      if (dto.positionId && existingTest.positionId && dto.positionId !== existingTest.positionId) {
        throw new BadRequestException("Test is attached to a different position");
      }

      await tx.test.update({
        where: { id: testId },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          tags: dto.tags ?? [],
          status: dto.status ?? TestStatus.DRAFT,
          ...(dto.closing || dto.estimatedDurationMinutes !== undefined ? { configuration: {
            ...this.closingFrom(existingTest.configuration).root,
            ...(dto.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: dto.estimatedDurationMinutes } : {}),
            ...(dto.closing ? { closing: { title: dto.closing.title, message: dto.closing.message,
              videoAssetId: this.closingFrom(existingTest.configuration).videoAssetId } } : {}),
          } as Prisma.InputJsonValue } : {}),
        },
      });

      const existingQuestionIds = new Set(existingTest.questions.map((question) => question.id));
      const incomingQuestionIds = new Set(questionIds);
      const removedQuestions = existingTest.questions.filter((question) => !incomingQuestionIds.has(question.id));

      if (removedQuestions.some((question) => question._count.responses > 0)) {
        throw new BadRequestException("Questions with candidate responses cannot be removed");
      }

      for (const question of removedQuestions) {
        await tx.question.delete({
          where: { id: question.id },
        });
      }

      const sortedQuestions = [...dto.questions].sort((left, right) => left.order - right.order);
      for (const question of sortedQuestions) {
        if (question.questionId && existingQuestionIds.has(question.questionId)) {
          await this.questions.updateQuestionInTest(tx, question.questionId, question, testId, question.order);
          continue;
        }

        await this.questions.createQuestionInTest(tx, question, testId, question.order);
      }

      return existingTest;
    });

    return this.getTest(test.id);
  }

  async appendQuestions(
    testId: string,
    dto: AppendTestQuestionsDto,
  ): Promise<TestResponse> {
    const orders = dto.questions.map((question) => question.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new BadRequestException("question order values must be unique within a batch");
    }

    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (!test) {
      throw new NotFoundException("Test not found");
    }

    const existingQuestions = await this.prisma.question.findMany({
      where: { testId },
      select: { order: true },
      orderBy: { order: "asc" },
    });

    const startingOrder = existingQuestions.length === 0
      ? 1
      : Math.max(...existingQuestions.map((question) => question.order)) + 1;

    const sortedQuestions = [...dto.questions].sort((left, right) => left.order - right.order);

    await this.prisma.$transaction(async (tx) => {
      for (const [index, question] of sortedQuestions.entries()) {
        await this.questions.createQuestionInTest(tx, question, testId, startingOrder + index);
      }
    });

    return this.getTest(testId);
  }

  async reorderQuestions(
  testId: string,
  dto: ReorderTestQuestionsDto,
): Promise<TestResponse> {
  const test = await this.prisma.test.findUnique({
    where: { id: testId },
    select: { id: true },
  });

  if (!test) {
    throw new NotFoundException("Test not found");
  }

  const existingQuestions = await this.prisma.question.findMany({
    where: { testId },
    select: { id: true },
    orderBy: { order: "asc" },
  });

  const existingIds = new Set(
    existingQuestions.map((question) => question.id),
  );

  const requestedIds = new Set(dto.questionIds);

  if (dto.questionIds.length !== existingQuestions.length) {
    throw new BadRequestException(
      "questionIds must contain every question in the test exactly once",
    );
  }

  for (const questionId of dto.questionIds) {
    if (!existingIds.has(questionId)) {
      throw new BadRequestException(
        "questionIds contains a question that does not belong to this test",
      );
    }
  }

  if (requestedIds.size !== existingIds.size) {
    throw new BadRequestException(
      "questionIds must contain every question in the test exactly once",
    );
  }

  await this.prisma.$transaction(
    dto.questionIds.map((questionId, index) =>
      this.prisma.question.update({
        where: { id: questionId },
        data: {
          order: index + 1,
        },
      }),
    ),
  );

  return this.getTest(testId);
}

  async getTest(testId: string): Promise<TestResponse> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new NotFoundException("Test not found");
    }

    const questions = await this.prisma.question.findMany({
      where: { testId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });

    const orderedQuestions = await Promise.all(
      questions.map(async (question) => ({
        ...(await this.questions.getQuestion(question.id)),
        order: question.order,
      })),
    );

    const closing = this.closingFrom(test.configuration);

    return {
      id: test.id,
      name: test.name,
      description: test.description,
      tags: test.tags,
      status: test.status,
      positionId: test.positionId,
      closing: { title: closing.title, message: closing.message, videoAvailable: Boolean(closing.videoAssetId) },
      estimatedDurationMinutes: typeof closing.root.estimatedDurationMinutes === "number"
        ? closing.root.estimatedDurationMinutes : null,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      questions: orderedQuestions,
    };
  }

  async uploadClosingVideo(testId: string, file: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    if (!file || file.size > QUESTION_VIDEO_MAX_BYTES || !QUESTION_VIDEO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Upload a supported video under 100 MB");
    }
    const test = await this.prisma.test.findUnique({ where: { id: testId }, select: { configuration: true } });
    if (!test) throw new NotFoundException("Test not found");
    const old = this.closingFrom(test.configuration);
    const assetId = randomUUID();
    const storageKey = `tests/${testId}/closing/${assetId}`;
    const asset = await this.prisma.questionAsset.create({ data: {
      id: assetId, kind: QuestionAssetKind.VIDEO, storageKey, mimeType: file.mimetype,
      size: file.size, checksum: createHash("sha256").update(file.buffer).digest("hex"), originalName: file.originalname,
    } });
    try {
      await this.storage.putObject(storageKey, file.buffer, file.mimetype);
      await this.prisma.test.update({ where: { id: testId }, data: { configuration: {
        ...old.root, closing: { title: old.title, message: old.message, videoAssetId: assetId },
      } as Prisma.InputJsonValue } });
    } catch (error) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      await this.prisma.questionAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
      throw error;
    }
    if (old.videoAssetId && old.videoAssetId !== assetId) await this.deleteClosingAsset(old.videoAssetId).catch(() => undefined);
    return this.getTest(testId);
  }

  async removeClosingVideo(testId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId }, select: { configuration: true } });
    if (!test) throw new NotFoundException("Test not found");
    const closing = this.closingFrom(test.configuration);
    await this.prisma.test.update({ where: { id: testId }, data: { configuration: {
      ...closing.root, closing: { title: closing.title, message: closing.message },
    } as Prisma.InputJsonValue } });
    if (closing.videoAssetId) await this.deleteClosingAsset(closing.videoAssetId).catch(() => undefined);
    return this.getTest(testId);
  }

  private async deleteClosingAsset(assetId: string) {
    const asset = await this.prisma.questionAsset.findUnique({ where: { id: assetId } });
    if (!asset) return;
    await this.prisma.questionAsset.delete({ where: { id: assetId } });
    await this.storage.deleteObject(asset.storageKey).catch(() => undefined);
  }

  async getClosingVideo(testId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId }, select: { configuration: true } });
    if (!test) throw new NotFoundException("Test not found");
    const assetId = this.closingFrom(test.configuration).videoAssetId;
    if (!assetId) throw new NotFoundException("Closing video not found");
    const asset = await this.prisma.questionAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.kind !== QuestionAssetKind.VIDEO || !asset.storageKey.startsWith(`tests/${testId}/closing/`)) throw new NotFoundException("Closing video not found");
    const file = await this.storage.openObject(asset.storageKey).catch(() => { throw new NotFoundException("Closing video not found"); });
    return { asset, file };
  }
}
