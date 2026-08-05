import { PromptMediaType, QuestionType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, Min, MinLength } from "class-validator";

export class CreateQuestionDto {
  @IsEnum(QuestionType) type!: QuestionType;
  @IsString() @MinLength(3) prompt!: string;
  @IsOptional() @IsString() helpText?: string;
  @IsOptional() @IsUrl({ require_tld: false }) promptMediaUrl?: string;
  @IsOptional() @IsEnum(PromptMediaType) promptMediaType?: PromptMediaType;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @Type(() => Number) @IsNumber() @Min(0.1) @Max(100) weight!: number;
  @IsBoolean() required!: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(600) preparationSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1800) answerSeconds?: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(10) maxRetries!: number;
}
