import { Module } from "@nestjs/common";
import { QuestionStorageService } from "./question-storage.service";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";
import { VideoTranscodingService } from "./video-transcoding.service";
import { VideoProcessingWorkerService } from "./video-processing-worker.service";

@Module({
  controllers: [QuestionsController],
  providers: [QuestionStorageService, QuestionsService, VideoTranscodingService, VideoProcessingWorkerService],
  exports: [QuestionStorageService, QuestionsService, VideoTranscodingService, VideoProcessingWorkerService],
})
export class QuestionsModule {}
