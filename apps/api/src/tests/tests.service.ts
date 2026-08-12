import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionsService } from "../questions/questions.service";
import { CreateTestDto, ReorderTestQuestionsDto } from "./create-test.dto";

export type TestQuestionResponse = Awaited<ReturnType<QuestionsService["getQuestion"]>> & {
  order: number;
};

export type TestResponse = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  status: TestStatus;
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
      const createdTest = await tx.test.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          tags: dto.tags ?? [],
          status: dto.status ?? TestStatus.DRAFT,
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
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      questions: orderedQuestions,
    };
  }
}
