import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from "./email-template.dto";
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

  @Post()
  @ApiOperation({ summary: "Create an email template" })
  createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplates.createTemplate(dto);
  }

  @Patch(":templateId")
  @ApiOperation({ summary: "Update an email template" })
  updateTemplate(@Param("templateId") templateId: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplates.updateTemplate(templateId, dto);
  }

  @Delete(":templateId")
  @ApiOperation({ summary: "Delete an unused email template" })
  deleteTemplate(@Param("templateId") templateId: string) {
    return this.emailTemplates.deleteTemplate(templateId);
  }
}
