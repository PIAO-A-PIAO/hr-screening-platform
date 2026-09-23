import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreateDepartmentDto, CreatePositionDto, ListPositionsQueryDto, UpdatePositionDto, UpdatePositionEmailSequenceDto, UpdatePositionStatusDto } from "./positions.dto";
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
        tags: { type: "array", items: { type: "string" } },
        departmentIds: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["OPEN", "CLOSED"] },
      },
      required: ["title"],
    },
  })
  createPosition(@Body() dto: CreatePositionDto) {
    return this.positions.createPosition(dto);
  }

  @Get("options")
  @ApiOperation({ summary: "List position tag and department options" })
  getOptions() {
    return this.positions.getOptions();
  }

  @Post("departments")
  @ApiOperation({ summary: "Create a department" })
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.positions.createDepartment(dto.name);
  }

  @Delete("departments/:departmentId")
  @ApiOperation({ summary: "Delete a department and remove its associations" })
  deleteDepartment(@Param("departmentId") departmentId: string) {
    return this.positions.deleteDepartment(departmentId);
  }

  @Delete("tags/:tag")
  @ApiOperation({ summary: "Remove a tag from every position" })
  deleteTag(@Param("tag") tag: string) {
    return this.positions.deleteTag(tag);
  }

  @Get(":positionId")
  @ApiOperation({ summary: "Retrieve a position" })
  @ApiParam({ name: "positionId" })
  getPosition(@Param("positionId") positionId: string) {
    return this.positions.getPosition(positionId);
  }

  @Patch(":positionId")
  @ApiOperation({ summary: "Update editable position fields" })
  updatePosition(@Param("positionId") positionId: string, @Body() dto: UpdatePositionDto) {
    return this.positions.updatePosition(positionId, dto);
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
          minItems: 0,
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
