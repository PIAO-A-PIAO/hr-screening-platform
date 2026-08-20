import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { QUESTION_VIDEO_MAX_BYTES } from "../questions/question.constants";
import { CreateResponseDto, UploadResponseVideoDto } from "./responses.dto";
import { ResponsesService } from "./responses.service";

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@ApiTags("responses")
@ApiHeader({ name: "x-invite-token", required: true })
@Controller("responses")
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  @Post()
  @ApiOperation({ summary: "Create one typed candidate response" })
  createResponse(
    @Body() dto: CreateResponseDto,
    @Headers("x-invite-token") inviteToken?: string,
  ) {
    return this.responses.createResponse(dto, inviteToken);
  }

  @Get(":responseId")
  @ApiOperation({ summary: "Retrieve one candidate response" })
  @ApiParam({ name: "responseId" })
  getResponse(
    @Param("responseId") responseId: string,
    @Headers("x-invite-token") inviteToken?: string,
  ) {
    return this.responses.getResponse(responseId, inviteToken);
  }

  @Post(":responseId/video")
  @ApiOperation({ summary: "Upload or retry a video for a VIDEO response" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: QUESTION_VIDEO_MAX_BYTES } }))
  uploadVideo(
    @Param("responseId") responseId: string,
    @UploadedFile() file: UploadFile,
    @Body() dto: UploadResponseVideoDto,
    @Headers("x-invite-token") inviteToken?: string,
  ) {
    return this.responses.uploadVideo(responseId, file, dto, inviteToken);
  }

  @Get(":responseId/video")
  @ApiOperation({ summary: "Stream the video attached to a VIDEO response" })
  async getVideo(
    @Param("responseId") responseId: string,
    @Headers("x-invite-token") inviteToken?: string,
  ) {
    const result = await this.responses.openVideo(responseId, inviteToken);
    return new StreamableFile(result.file.stream, {
      type: result.asset.mimeType,
      disposition: "inline",
      length: result.file.contentLength,
    });
  }
}