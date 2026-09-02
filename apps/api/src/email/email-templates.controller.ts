import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { EmailTemplatesService } from "./email-templates.service";

@ApiTags("email-templates")
@Controller("email/templates")
export class EmailTemplatesController {
  constructor(private readonly emailTemplates: EmailTemplatesService) {}

  @Get()
  @ApiOperation({ summary: "List email templates" })
  listTemplates() {
    return this.emailTemplates.listTemplates();
  }
}
