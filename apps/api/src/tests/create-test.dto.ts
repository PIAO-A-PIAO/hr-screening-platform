import { TestStatus, QuestionType } from "@prisma/client";
import {
  ArrayUnique,
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
  @IsOptional()
  @IsString()
  questionId?: string;

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

  @IsOptional()
  @IsString()
  positionId?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateTestQuestionDto)
  questions!: CreateTestQuestionDto[];
}

export class ReorderTestQuestionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  questionIds!: string[];
}

export class AppendTestQuestionsDto {
  @ValidateNested({ each: true })
  @Type(() => CreateTestQuestionDto)
  questions!: CreateTestQuestionDto[];
}
