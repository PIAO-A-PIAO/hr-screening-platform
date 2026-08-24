import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { QuestionType, ResponseType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionStorageService } from "../questions/question-storage.service";
import { VideoTranscodingService } from "../questions/video-transcoding.service";
import { ResponsesService } from "./responses.service";

function createHarness() {
  const prisma = {
    userTestAssignment: { findUnique: jest.fn() },
    question: { findUnique: jest.fn() },
    response: { findUnique: jest.fn(), create: jest.fn() },
    responseAsset: { create: jest.fn(), delete: jest.fn() },
    videoResponseItem: { update: jest.fn() },
  };
  const storage = {
    putObject: jest.fn(),
    deleteObject: jest.fn(),
    openObject: jest.fn(),
  };
  const transcoder = {
    transcodeUpload: jest.fn(),
  };
  const service = new ResponsesService(
    prisma as unknown as PrismaService,
    storage as unknown as QuestionStorageService,
    transcoder as unknown as VideoTranscodingService,
  );

  return { prisma, storage, transcoder, service };
}

const baseDto = {
  type: ResponseType.SHORT_ANSWER,
  questionId: "question-1",
  userId: "candidate-1",
  testId: "test-1",
  item: { textValue: "A concise answer" },
};

describe("ResponsesService", () => {
  it("rejects a candidate who is not assigned to the test", async () => {
    const { prisma, service } = createHarness();
    prisma.userTestAssignment.findUnique.mockResolvedValue(null);

    await expect(service.createResponse(baseDto, "token-1"))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a response type that does not match the question", async () => {
    const { prisma, service } = createHarness();
    prisma.userTestAssignment.findUnique.mockResolvedValue({ inviteToken: "token-1" });
    prisma.question.findUnique.mockResolvedValue({
      id: "question-1",
      testId: "test-1",
      type: QuestionType.VIDEO,
      multipleChoiceItem: null,
      shortAnswerItem: null,
    });

    await expect(service.createResponse(baseDto, "token-1"))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns an explicit conflict for a duplicate candidate response", async () => {
    const { prisma, service } = createHarness();
    prisma.userTestAssignment.findUnique.mockResolvedValue({ inviteToken: "token-1" });
    prisma.question.findUnique.mockResolvedValue({
      id: "question-1",
      testId: "test-1",
      type: QuestionType.SHORT_ANSWER,
      multipleChoiceItem: null,
      shortAnswerItem: { maxLength: 200 },
    });
    prisma.response.findUnique.mockResolvedValue({ id: "response-existing" });

    await expect(service.createResponse(baseDto, "token-1"))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a selected option from another question", async () => {
    const { prisma, service } = createHarness();
    prisma.userTestAssignment.findUnique.mockResolvedValue({ inviteToken: "token-1" });
    prisma.question.findUnique.mockResolvedValue({
      id: "question-1",
      testId: "test-1",
      type: QuestionType.MULTIPLE_CHOICE,
      multipleChoiceItem: {
        allowMultipleSelection: false,
        options: [{ id: "allowed-option" }],
      },
      shortAnswerItem: null,
    });
    prisma.response.findUnique.mockResolvedValue(null);

    await expect(service.createResponse({
      ...baseDto,
      type: ResponseType.MULTIPLE_CHOICE,
      item: { selectedOptionIds: ["other-question-option"] },
    }, "token-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("removes response-asset metadata when object storage fails so upload can be retried", async () => {
    const { prisma, storage, transcoder, service } = createHarness();
    prisma.response.findUnique.mockResolvedValue({
      id: "response-1",
      type: ResponseType.VIDEO,
      questionId: "question-1",
      userId: "candidate-1",
      testId: "test-1",
      attemptId: null,
      score: null,
      evaluatorUserId: null,
      evaluatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      videoItem: { responseId: "response-1", assetId: null, asset: null },
      multipleChoiceItem: null,
      shortAnswerItem: null,
    });
    prisma.userTestAssignment.findUnique.mockResolvedValue({ inviteToken: "token-1" });
    transcoder.transcodeUpload.mockResolvedValue({
      preparedBuffer: Buffer.from("prepared-video"),
      preparedMimeType: "video/webm",
      preparedSize: 14,
      preparedDurationSeconds: 3,
    });
    prisma.responseAsset.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...data, createdAt: new Date() }),
    );
    storage.putObject.mockRejectedValue(new Error("storage unavailable"));
    prisma.responseAsset.delete.mockResolvedValue({});

    await expect(service.uploadVideo(
      "response-1",
      {
        buffer: Buffer.from("source-video"),
        mimetype: "video/webm",
        originalname: "recording.webm",
        size: 12,
      },
      {},
      "token-1",
    )).rejects.toThrow("storage unavailable");

    expect(prisma.responseAsset.delete).toHaveBeenCalledTimes(1);
    expect(prisma.videoResponseItem.update).not.toHaveBeenCalled();
  });
});