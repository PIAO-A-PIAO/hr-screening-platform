import { FileInterceptor } from "@nestjs/platform-express";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { QUESTION_THUMBNAIL_MAX_BYTES, QUESTION_THUMBNAIL_MIME_TYPES, QUESTION_VIDEO_MAX_BYTES, QUESTION_VIDEO_MIME_TYPES } from "./question.constants";
import { CreateQuestionDto } from "./create-question.dto";
import { QuestionsService } from "./questions.service";
import { UploadQuestionAssetDto } from "./upload-question-asset.dto";

function mimePattern(values: Set<string>) {
  return new RegExp(`^(${Array.from(values).map((value) => value.replaceAll("/", "\\/")).join("|")})$`);
}

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@ApiTags("questions")
@Controller("questions")
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: "List all questions" })
  getQuestions() {
    return this.questions.listQuestions();
  }

  @Post()
  @ApiOperation({ summary: "Create a screening question" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        type: { type: "string", enum: ["VIDEO", "MULTIPLE_CHOICE", "SHORT_ANSWER"] },
        item: { type: "object" },
      },
      required: ["title", "type", "item"],
    },
  })
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questions.createQuestion(dto);
  }

  @Get(":questionId")
  @ApiOperation({ summary: "Retrieve a question by questionId" })
  @ApiParam({ name: "questionId" })
  getQuestion(@Param("questionId") questionId: string) {
    return this.questions.getQuestion(questionId);
  }

  @Post(":questionId/video")
  @ApiOperation({ summary: "Upload a video blob for a video question" })
  @ApiParam({ name: "questionId" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        ownerId: { type: "string" },
        durationSeconds: { type: "number" },
      },
      required: ["file"],
    },
  })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: QUESTION_VIDEO_MAX_BYTES },
  }))
  async uploadVideo(
    @Param("questionId") questionId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: mimePattern(QUESTION_VIDEO_MIME_TYPES) })
        .build({
          errorHttpStatusCode: 400,
          fileIsRequired: true,
        }),
    ) file: UploadFile,
    @Body() dto: UploadQuestionAssetDto,
  ) {
    const result = await this.questions.uploadVideo(questionId, file, dto);
    return {
      videoId: result.assetId,
      ...result,
    };
  }

  @Post("video/transcode")
  @ApiOperation({ summary: "Transcode a recorded video blob and report compression" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
      required: ["file"],
    },
  })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: QUESTION_VIDEO_MAX_BYTES },
  }))
  async transcodeVideo(
    @UploadedFile(
      new ParseFilePipeBuilder().build({
        errorHttpStatusCode: 400,
        fileIsRequired: true,
      }),
    ) file: UploadFile,
  ) {
    const result = await this.questions.transcodeVideoBlob(file);
    return {
      compressionPercentage: result.compressionPercentage,
      sourceSize: result.sourceSize,
      preparedSize: result.preparedSize,
      sourceMimeType: result.sourceMimeType,
      preparedMimeType: result.preparedMimeType,
      sourceCodec: result.sourceCodec,
      preparedCodec: result.preparedCodec,
      sourceDurationSeconds: result.sourceDurationSeconds,
      preparedDurationSeconds: result.preparedDurationSeconds,
    };
  }

  @Get(":questionId/video")
  @ApiOperation({ summary: "Stream the video blob for a video question" })
  @ApiParam({ name: "questionId" })
  async getVideo(@Param("questionId") questionId: string) {
    const result = await this.questions.getVideo(questionId);
    return new StreamableFile(result.file.stream, {
      type: result.asset.mimeType,
      disposition: "inline",
      length: result.file.contentLength,
    });
  }

  @Post(":questionId/thumbnail")
  @ApiOperation({ summary: "Upload a thumbnail blob for a video question" })
  @ApiParam({ name: "questionId" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        ownerId: { type: "string" },
      },
      required: ["file"],
    },
  })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: QUESTION_THUMBNAIL_MAX_BYTES },
  }))
  async uploadThumbnail(
    @Param("questionId") questionId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: mimePattern(QUESTION_THUMBNAIL_MIME_TYPES) })
        .build({
          errorHttpStatusCode: 400,
          fileIsRequired: true,
        }),
    ) file: UploadFile,
    @Body() dto: UploadQuestionAssetDto,
  ) {
    const result = await this.questions.uploadThumbnail(questionId, file, dto);
    return {
      thumbnailId: result.assetId,
      ...result,
    };
  }

  @Get(":questionId/thumbnail")
  @ApiOperation({ summary: "Stream the thumbnail blob for a video question" })
  @ApiParam({ name: "questionId" })
  async getThumbnail(@Param("questionId") questionId: string) {
    const result = await this.questions.getThumbnail(questionId);
    return new StreamableFile(result.file.stream, {
      type: result.asset.mimeType,
      disposition: "inline",
      length: result.file.contentLength,
    });
  }
}
