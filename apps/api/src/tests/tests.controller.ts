import { Body, Controller, Delete, Get, Param, Patch, Post, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { QUESTION_VIDEO_MAX_BYTES } from "../questions/question.constants";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AppendTestQuestionsDto, CreateTestDto, ReorderTestQuestionsDto } from "./create-test.dto";
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
        positionId: { type: "string" },
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

  @Patch(":testId")
  @ApiOperation({ summary: "Update a test and its ordered questions" })
  @ApiParam({ name: "testId" })
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
              questionId: { type: "string" },
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
  updateTest(@Param("testId") testId: string, @Body() dto: CreateTestDto) {
    return this.tests.updateTest(testId, dto);
  }

  @Post(":testId/questions")
  @ApiOperation({ summary: "Append questions to an existing test" })
  @ApiParam({ name: "testId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
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
      required: ["questions"],
    },
  })
  appendQuestions(@Param("testId") testId: string, @Body() dto: AppendTestQuestionsDto) {
    return this.tests.appendQuestions(testId, dto);
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

  @Post(":testId/closing-video")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: QUESTION_VIDEO_MAX_BYTES } }))
  uploadClosingVideo(@Param("testId") testId: string, @UploadedFile() file: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    return this.tests.uploadClosingVideo(testId, file);
  }

  @Get(":testId/closing-video")
  async getClosingVideo(@Param("testId") testId: string) {
    const { asset, file } = await this.tests.getClosingVideo(testId);
    return new StreamableFile(file.stream, { type: asset.mimeType, disposition: "inline", length: file.contentLength });
  }

  @Delete(":testId/closing-video")
  removeClosingVideo(@Param("testId") testId: string) {
    return this.tests.removeClosingVideo(testId);
  }
}
