import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
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
  @ApiOperation({ summary: "Create email template" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        key: { type: "string" },
        name: { type: "string" },
        subject: { type: "string" },
        html: { type: "string" },
        text: { type: "string" },
      },
      required: ["key", "name", "subject", "html"],
    },
  })
  createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplates.createTemplate(dto);
  }

  @Patch(":templateId")
  @ApiOperation({ summary: "Update email template" })
  @ApiParam({ name: "templateId" })
  updateTemplate(
    @Param("templateId") templateId: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplates.updateTemplate(templateId, dto);
  }

  @Delete(":templateId")
  @ApiOperation({ summary: "Delete email template" })
  @ApiParam({ name: "templateId" })
  deleteTemplate(@Param("templateId") templateId: string) {
    return this.emailTemplates.deleteTemplate(templateId);
  }
}
