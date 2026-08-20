import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ResponsesModule } from "../responses/responses.module";
import { AttemptsController } from "./attempts.controller";
import { AttemptsService } from "./attempts.service";

@Module({
  imports: [PrismaModule, ResponsesModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
