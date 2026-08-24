import { Module } from "@nestjs/common";
import { QuestionsModule } from "../questions/questions.module";
import { ResponsesController } from "./responses.controller";
import { ResponsesService } from "./responses.service";

@Module({
  imports: [QuestionsModule],
  controllers: [ResponsesController],
  providers: [ResponsesService],
  exports: [ResponsesService],
})
export class ResponsesModule {}
