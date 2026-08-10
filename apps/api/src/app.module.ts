import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuestionsModule } from "./questions/questions.module";
import { TestsModule } from "./tests/tests.module";

@Module({
  imports: [PrismaModule, HealthModule, QuestionsModule, TestsModule],
  controllers: [AppController],
})
export class AppModule {}
