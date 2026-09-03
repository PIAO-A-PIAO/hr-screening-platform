import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreatePositionDto } from "./positions.dto";
import { PositionsService } from "./positions.service";

@ApiTags("positions")
@Controller("positions")
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @ApiOperation({ summary: "List all positions" })
  getPositions() {
    return this.positions.listPositions();
  }

  @Post()
  @ApiOperation({ summary: "Create a position" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        department: { type: "string" },
        location: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "OPEN", "ON_HOLD", "CLOSED"] },
        owner: { type: "string" },
      },
      required: ["title", "department", "location", "owner"],
    },
  })
  createPosition(@Body() dto: CreatePositionDto) {
    return this.positions.createPosition(dto);
  }

  @Get(":positionId")
  @ApiOperation({ summary: "Retrieve a position" })
  @ApiParam({ name: "positionId" })
  getPosition(@Param("positionId") positionId: string) {
    return this.positions.getPosition(positionId);
  }
}
