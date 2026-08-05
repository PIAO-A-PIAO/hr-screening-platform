import { BadRequestException, Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { diskStorage } from "multer";
import { getEnvironment, resolveFromRepository } from "../config/environment";
import { MediaController } from "./media.controller";

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: () => ({
        storage: diskStorage({
          destination: resolveFromRepository(getEnvironment().UPLOAD_DIR),
          filename: (_request, file, callback) => callback(
            null,
            `${randomUUID()}${extname(file.originalname) || ".webm"}`,
          ),
        }),
        limits: { fileSize: 250 * 1024 * 1024 },
        fileFilter: (_request, file, callback) => {
          const accepted = file.mimetype.startsWith("video/")
            || file.mimetype.startsWith("image/")
            || file.mimetype === "application/pdf";
          callback(accepted ? null : new BadRequestException("Unsupported media type"), accepted);
        },
      }),
    }),
  ],
  controllers: [MediaController],
})
export class MediaModule {}
