import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DemoAuthGuard } from "./auth/demo-auth.guard";
import { CandidateModule } from "./candidate/candidate.module";
import { InterviewsModule } from "./interviews/interviews.module";
import { JobsModule } from "./jobs/jobs.module";
import { MediaModule } from "./media/media.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReviewsModule } from "./reviews/reviews.module";

@Module({
  imports: [PrismaModule, JobsModule, InterviewsModule, CandidateModule, ReviewsModule, MediaModule],
  providers: [{ provide: APP_GUARD, useClass: DemoAuthGuard }],
})
export class AppModule {}
