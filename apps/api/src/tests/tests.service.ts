import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionsService } from "../questions/questions.service";
import { CreateTestDto } from "./create-test.dto";

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

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
  ) {}

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
