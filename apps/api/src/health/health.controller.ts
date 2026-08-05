import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  @ApiOperation({ summary: "Confirm that the API process is alive" })
  live() {
    return { status: "alive" as const };
  }

  @Get("ready")
  @ApiOperation({ summary: "Confirm that PostgreSQL and private storage are ready" })
  @ApiResponse({ status: 200, description: "Required dependencies are ready" })
  @ApiResponse({ status: 503, description: "A required dependency is unavailable" })
  async ready() {
    const result = await this.health.readiness();
    if (result.status === "not_ready") {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
