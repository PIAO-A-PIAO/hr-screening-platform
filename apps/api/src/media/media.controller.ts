import { BadRequestException, Controller, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Public } from "../auth/public.decorator";

@Public()
@ApiTags("media")
@Controller("media")
export class MediaController {
  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Req() request: Request) {
    if (!file) throw new BadRequestException("Select a file to upload");
    return { url: `${request.protocol}://${request.get("host")}/uploads/${file.filename}`, contentType: file.mimetype };
  }
}
