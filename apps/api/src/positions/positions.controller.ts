import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreatePositionDto, ListPositionsQueryDto, UpdatePositionEmailSequenceDto, UpdatePositionStatusDto } from "./positions.dto";
import { PositionsService } from "./positions.service";

@ApiTags("positions")
@Controller("positions")
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @ApiOperation({ summary: "List all positions" })
  getPositions(@Query() query: ListPositionsQueryDto) {
    return this.positions.listPositions(query);
  }

  @Post()
  @ApiOperation({ summary: "Create a position" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        departmentIds: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["DRAFT", "OPEN", "CLOSED"] },
      },
      required: ["title"],
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

  @Patch(":positionId/status")
  @ApiOperation({ summary: "Update a position status" })
  updateStatus(@Param("positionId") positionId: string, @Body() dto: UpdatePositionStatusDto) {
    return this.positions.updateStatus(positionId, dto.status);
  }

  @Delete(":positionId/interviews/:interviewId")
  @ApiOperation({ summary: "Delete a candidate interview from a position" })
  @ApiParam({ name: "positionId" })
  @ApiParam({ name: "interviewId" })
  deleteInterview(
    @Param("positionId") positionId: string,
    @Param("interviewId") interviewId: string,
  ) {
    return this.positions.deleteInterview(positionId, interviewId);
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
