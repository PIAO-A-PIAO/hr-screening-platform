import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "./auth/access.decorator";

@ApiTags("system")
@Controller()
@Public()
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
