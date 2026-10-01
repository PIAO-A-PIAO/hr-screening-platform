import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ResponsesModule } from "../responses/responses.module";
import { AttemptsController } from "./attempts.controller";
import { AttemptsService } from "./attempts.service";
import { EmailModule } from "../email/email.module";
import { TestsModule } from "../tests/tests.module";
import { QuestionsModule } from "../questions/questions.module";

@Module({
  imports: [PrismaModule, ResponsesModule, EmailModule, TestsModule, QuestionsModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
