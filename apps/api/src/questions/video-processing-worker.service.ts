import { createHash, randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { QuestionAssetKind, VideoProcessingStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionStorageService } from "./question-storage.service";
import { VideoTranscodingService } from "./video-transcoding.service";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class VideoProcessingWorkerService {
  private readonly logger = new Logger(VideoProcessingWorkerService.name);
  private stopped = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: QuestionStorageService,
    private readonly transcoder: VideoTranscodingService,
  ) {}
  stop() { this.stopped = true; }

  async run() {
    this.logger.log("Listening for question video processing jobs");
    while (!this.stopped) {
      try {
        const job = await this.prisma.videoProcessingJob.findFirst({
          where: { OR: [
            { status: VideoProcessingStatus.PENDING, nextAttemptAt: { lte: new Date() } },
            { status: VideoProcessingStatus.PROCESSING, updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
          ] },
          orderBy: { createdAt: "asc" },
        });
        if (!job) { await wait(3000); continue; }
        const claimed = await this.prisma.videoProcessingJob.updateMany({
          where: { id: job.id, status: job.status, updatedAt: job.updatedAt },
          data: { status: VideoProcessingStatus.PROCESSING, attempts: { increment: 1 } },
        });
        if (!claimed.count) continue;
        try {
          const processedAssetId = await this.process(job.questionId, job.sourceAssetId, job.previousAssetId);
          await this.prisma.videoProcessingJob.update({ where: { id: job.id }, data: { status: VideoProcessingStatus.DONE, processedAssetId } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown video processing error";
          this.logger.warn(`Question video job ${job.id}: ${message}`);
          const attempts = job.attempts + 1;
          await this.prisma.videoProcessingJob.update({ where: { id: job.id }, data: {
            status: attempts >= 3 ? VideoProcessingStatus.FAILED : VideoProcessingStatus.PENDING,
            nextAttemptAt: new Date(Date.now() + Math.min(attempts * 30_000, 120_000)),
            lastError: message.slice(0, 1000),
          } });
        }
      } catch (error) {
        this.logger.error(error instanceof Error ? error.message : "Video worker failed");
        await wait(3000);
      }
    }
  }

  private async process(questionId: string, sourceAssetId: string, previousAssetId: string | null) {
    const current = await this.prisma.videoQuestionItem.findUnique({ where: { questionId }, select: { videoAssetId: true, thumbnailAssetId: true } });
    if (current?.videoAssetId !== sourceAssetId) return null; // A newer upload superseded this job.
    const source = await this.prisma.questionAsset.findUnique({ where: { id: sourceAssetId } });
    if (!source) throw new Error("Original video asset is missing");
    const chunks: Buffer[] = [];
    for await (const chunk of (await this.storage.openObject(source.storageKey)).stream) chunks.push(Buffer.from(chunk));
    const prepared = await this.transcoder.transcodeBuffer({ buffer: Buffer.concat(chunks), mimeType: source.mimeType, originalName: source.originalName ?? "question-video" });
    const thumbnail = await this.transcoder.createThumbnail(prepared.preparedBuffer);
    const videoId = randomUUID();
    const thumbnailId = randomUUID();
    const videoKey = `questions/${questionId}/video/${videoId}`;
    const thumbnailKey = `questions/${questionId}/thumbnail/${thumbnailId}`;
    let replaced = false;
    try {
      await this.storage.putObject(videoKey, prepared.preparedBuffer, "video/mp4");
      await this.storage.putObject(thumbnailKey, thumbnail, "image/jpeg");
      replaced = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.videoQuestionItem.updateMany({ where: { questionId, videoAssetId: sourceAssetId }, data: { videoAssetId: null } });
        if (!updated.count) return false;
        await tx.questionAsset.createMany({ data: [
          { id: videoId, kind: QuestionAssetKind.VIDEO, storageKey: videoKey, mimeType: "video/mp4", size: prepared.preparedSize, durationSeconds: prepared.preparedDurationSeconds, checksum: createHash("sha256").update(prepared.preparedBuffer).digest("hex"), originalName: source.originalName, ownerId: source.ownerId },
          { id: thumbnailId, kind: QuestionAssetKind.THUMBNAIL, storageKey: thumbnailKey, mimeType: "image/jpeg", size: thumbnail.length, checksum: createHash("sha256").update(thumbnail).digest("hex"), ownerId: source.ownerId },
        ] });
        await tx.videoQuestionItem.update({ where: { questionId }, data: { videoAssetId: videoId, thumbnailAssetId: thumbnailId } });
        return true;
      });
    } catch (error) {
      if (!replaced) {
        await this.storage.deleteObject(videoKey).catch(() => undefined);
        await this.storage.deleteObject(thumbnailKey).catch(() => undefined);
      }
      throw error;
    }
    if (!replaced) {
      await this.storage.deleteObject(videoKey).catch(() => undefined);
      await this.storage.deleteObject(thumbnailKey).catch(() => undefined);
      return null;
    }
    // Both generated objects are stored and linked; only now may source assets be removed.
    for (const assetId of [sourceAssetId, previousAssetId, current.thumbnailAssetId]) {
      if (!assetId || assetId === videoId || assetId === thumbnailId) continue;
      const asset = await this.prisma.questionAsset.findUnique({ where: { id: assetId } });
      if (!asset) continue;
      await this.storage.deleteObject(asset.storageKey).catch(() => undefined);
      await this.prisma.questionAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    }
    return videoId;
  }
}
