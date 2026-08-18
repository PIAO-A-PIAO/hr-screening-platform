import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreateTestDto, ReorderTestQuestionsDto } from "./create-test.dto";
import { TestsService } from "./tests.service";

@ApiTags("tests")
@Controller("tests")
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Get()
  @ApiOperation({ summary: "List all tests" })
  getTests() {
    return this.tests.listTests();
  }

  @Post()
  @ApiOperation({ summary: "Create a test with ordered questions" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              type: { type: "string", enum: ["VIDEO", "MULTIPLE_CHOICE", "SHORT_ANSWER"] },
              order: { type: "number" },
              item: { type: "object" },
            },
            required: ["title", "type", "order", "item"],
          },
        },
      },
      required: ["name", "questions"],
    },
  })
  createTest(@Body() dto: CreateTestDto) {
    return this.tests.createTest(dto);
  }

  @Patch(":testId/questions/order")
  @ApiOperation({
  summary: "Replace the question order for a test",
  })
  @ApiParam({ name: "testId" })
  reorderQuestions(
  @Param("testId") testId: string,
  @Body() dto: ReorderTestQuestionsDto,
  ) {
  return this.tests.reorderQuestions(testId, dto);
  }

  @Get(":testId")
  @ApiOperation({ summary: "Retrieve a test with its ordered questions" })
  @ApiParam({ name: "testId" })
  getTest(@Param("testId") testId: string) {
    return this.tests.getTest(testId);
  }
}
