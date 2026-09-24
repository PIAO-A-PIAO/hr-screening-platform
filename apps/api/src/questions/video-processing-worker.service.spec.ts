import { Readable } from "node:stream";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionStorageService } from "./question-storage.service";
import { VideoTranscodingService } from "./video-transcoding.service";
import { VideoProcessingWorkerService } from "./video-processing-worker.service";

describe("question video processing", () => {
  it("keeps the uploaded source when transcoding fails", async () => {
    const prisma = {
      videoQuestionItem: { findUnique: jest.fn().mockResolvedValue({ videoAssetId: "original", thumbnailAssetId: null }) },
      questionAsset: { findUnique: jest.fn().mockResolvedValue({ id: "original", storageKey: "original-key", mimeType: "video/webm", originalName: "question.webm" }) },
    };
    const storage = {
      openObject: jest.fn().mockResolvedValue({ stream: Readable.from([Buffer.from("original")]) }),
      putObject: jest.fn(), deleteObject: jest.fn(),
    };
    const transcoder = { transcodeBuffer: jest.fn().mockRejectedValue(new Error("ffmpeg unavailable")) };
    const worker = new VideoProcessingWorkerService(
      prisma as unknown as PrismaService,
      storage as unknown as QuestionStorageService,
      transcoder as unknown as VideoTranscodingService,
    );
    await expect((worker as unknown as { process: (questionId: string, sourceId: string, previousId: string | null) => Promise<unknown> })
      .process("question", "original", null)).rejects.toThrow("ffmpeg unavailable");
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.videoQuestionItem.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { questionId: "question" } }));
  });
});
