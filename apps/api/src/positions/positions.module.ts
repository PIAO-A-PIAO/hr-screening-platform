import { CandidateStagesController } from "../candidate-stages/candidate-stages.controller";
import { CandidateStagesService } from "../candidate-stages/candidate-stages.service";
import { ReviewerAuth } from "../candidate-stages/reviewer-auth";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PositionsController } from "./positions.controller";
import { PositionsService } from "./positions.service";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [PositionsController, CandidateStagesController],
  providers: [PositionsService, CandidateStagesService, ReviewerAuth],
})
export class PositionsModule {}
