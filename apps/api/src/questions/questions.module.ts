import { Module } from "@nestjs/common";
import { QuestionStorageService } from "./question-storage.service";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";
import { VideoTranscodingService } from "./video-transcoding.service";

@Module({
  controllers: [QuestionsController],
  providers: [QuestionStorageService, QuestionsService, VideoTranscodingService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
