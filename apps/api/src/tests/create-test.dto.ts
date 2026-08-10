import { TestStatus, QuestionType } from "@prisma/client";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateTestQuestionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsInt()
  @Min(0)
  order!: number;

  @IsObject()
  item!: Record<string, unknown>;
}

export class CreateTestDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(TestStatus)
  status?: TestStatus;

  @ValidateNested({ each: true })
  @Type(() => CreateTestQuestionDto)
  questions!: CreateTestQuestionDto[];
}
