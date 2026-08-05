import { BadRequestException, Controller, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { randomUUID } from "node:crypto";
import { extname, resolve } from "node:path";
import { diskStorage } from "multer";
import { Public } from "../auth/public.decorator";

const uploadDir = resolve(process.env.UPLOAD_DIR ?? "./var/uploads");

@Public()
@ApiTags("media")
@Controller("media")
export class MediaController {
  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: uploadDir,
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname) || ".webm"}`),
    }),
    limits: { fileSize: 250 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const accepted = file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
      callback(accepted ? null : new BadRequestException("Unsupported media type"), accepted);
    },
  }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Req() request: Request) {
    if (!file) throw new BadRequestException("Select a file to upload");
    return { url: `${request.protocol}://${request.get("host")}/uploads/${file.filename}`, contentType: file.mimetype };
  }
}
