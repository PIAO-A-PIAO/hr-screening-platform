import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailTemplatesController } from "./email-templates.controller";
import { EmailTemplatesService } from "./email-templates.service";
import { EmailService } from "./email.service";
import { EmailSettingsService } from "./email-settings.service";

@Module({
  imports: [PrismaModule],
  controllers: [EmailTemplatesController],
  providers: [EmailService, EmailTemplatesService, EmailSettingsService],
  exports: [EmailService, EmailTemplatesService],
})
export class EmailModule {}
