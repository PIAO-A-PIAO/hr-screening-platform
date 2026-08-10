import { Module } from "@nestjs/common";
import { QuestionStorageService } from "./question-storage.service";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";

@Module({
  controllers: [QuestionsController],
  providers: [QuestionStorageService, QuestionsService],
})
export class QuestionsModule {}
