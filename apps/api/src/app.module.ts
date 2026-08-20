import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PositionsModule } from "./positions/positions.module";
import { QuestionsModule } from "./questions/questions.module";
import { UsersModule } from "./users/users.module";
import { TestsModule } from "./tests/tests.module";
import { ResponsesModule } from "./responses/responses.module";
import { AttemptsModule } from "./attempts/attempts.module";

@Module({
  imports: [PrismaModule, HealthModule, QuestionsModule, TestsModule, UsersModule, ResponsesModule, AttemptsModule, PositionsModule],
  controllers: [AppController],
})
export class AppModule {}
