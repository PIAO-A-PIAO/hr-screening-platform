import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UploadQuestionAssetDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  durationSeconds?: number;
}
