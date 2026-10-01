import { TestStatus, QuestionType } from "@prisma/client";
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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

export class TestClosingDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(1000)
  message!: string;
}

export class CreateTestDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  estimatedDurationMinutes?: number | null;

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

  @IsOptional()
  @ValidateNested()
  @Type(() => TestClosingDto)
  closing?: TestClosingDto;

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
