import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionsService } from "../questions/questions.service";
import { AppendTestQuestionsDto, CreateTestDto, ReorderTestQuestionsDto } from "./create-test.dto";

export type TestQuestionResponse = Awaited<ReturnType<QuestionsService["getQuestion"]>> & {
  order: number;
};

export type TestResponse = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  status: TestStatus;
  positionId: string | null;
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
  ) {}

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

    return {
      id: test.id,
      name: test.name,
      description: test.description,
      tags: test.tags,
      status: test.status,
      positionId: test.positionId,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      questions: orderedQuestions,
    };
  }
}
