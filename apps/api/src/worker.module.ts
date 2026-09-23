import { Module } from "@nestjs/common";
import { EmailModule } from "./email/email.module";
import { EmailWorkerService } from "./email/email-worker.service";
import { PrismaModule } from "./prisma/prisma.module";
import { QuestionsModule } from "./questions/questions.module";

@Module({
  imports: [PrismaModule, EmailModule, QuestionsModule],
  providers: [EmailWorkerService],
  exports: [EmailWorkerService],
})
export class WorkerModule {}
