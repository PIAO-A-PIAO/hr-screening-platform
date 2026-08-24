import { ResponseType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, Min } from "class-validator";

export class CreateResponseDto {
  @IsEnum(ResponseType)
  type!: ResponseType;

  @IsString()
  questionId!: string;

  @IsString()
  userId!: string;

  @IsString()
  testId!: string;

  @IsObject()
  item!: Record<string, unknown>;
}

export class UploadResponseVideoDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationSeconds?: number;
}