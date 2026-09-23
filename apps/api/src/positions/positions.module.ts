import { CandidateStagesController } from "../candidate-stages/candidate-stages.controller";
import { CandidateStagesService } from "../candidate-stages/candidate-stages.service";
import { ReviewerAuth } from "../candidate-stages/reviewer-auth";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PositionsController } from "./positions.controller";
import { PositionsService } from "./positions.service";
import { EmailModule } from "../email/email.module";
import { AttemptsModule } from "../attempts/attempts.module";
import { ResponsesModule } from "../responses/responses.module";

@Module({
  imports: [PrismaModule, EmailModule, AttemptsModule, ResponsesModule],
  controllers: [PositionsController, CandidateStagesController],
  providers: [PositionsService, CandidateStagesService, ReviewerAuth],
})
export class PositionsModule {}
