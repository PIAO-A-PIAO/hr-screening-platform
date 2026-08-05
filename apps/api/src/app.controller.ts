import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("system")
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: "Describe the clean Milestone 0 API" })
  root() {
    return {
      name: "DS-HR API",
      milestone: 0,
      scope: "foundation-only",
    } as const;
  }
}
