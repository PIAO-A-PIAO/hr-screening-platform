import { Module } from "@nestjs/common";
import { QuestionsModule } from "../questions/questions.module";
import { QuestionStorageService } from "../questions/question-storage.service";
import { PrismaModule } from "../prisma/prisma.module";
import { TestsController } from "./tests.controller";
import { TestsService } from "./tests.service";

@Module({
  imports: [PrismaModule, QuestionsModule],
  controllers: [TestsController],
  providers: [TestsService, QuestionStorageService],
})
export class TestsModule {}
