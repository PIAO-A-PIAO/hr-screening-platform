import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
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

  @Delete(":positionId/assignments/:assignmentId")
  @ApiOperation({ summary: "Delete a candidate assignment from a position" })
  @ApiParam({ name: "positionId" })
  @ApiParam({ name: "assignmentId" })
  deleteAssignment(
    @Param("positionId") positionId: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.positions.deleteAssignment(positionId, assignmentId);
  }

  @Patch(":positionId/email-sequence")
  @ApiOperation({ summary: "Update the invitation/reminder sequence for a position" })
  @ApiParam({ name: "positionId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: {
              templateId: { type: "string" },
              delayValue: { type: "integer", minimum: 1 },
              delayUnit: { type: "string", enum: ["MINUTES", "HOURS", "DAYS"] },
              order: { type: "integer", minimum: 1 },
              stopCondition: {
                type: "string",
                enum: ["CANDIDATE_SUBMITTED", "CANDIDATE_DISCARDED", "POSITION_CLOSED"],
              },
            },
            required: ["templateId", "delayValue", "delayUnit", "order"],
          },
        },
      },
      required: ["steps"],
    },
  })
  updateEmailSequence(
    @Param("positionId") positionId: string,
    @Body() dto: UpdatePositionEmailSequenceDto,
  ) {
    return this.positions.updateEmailSequence(positionId, dto);
  }
}
