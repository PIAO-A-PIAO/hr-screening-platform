import { QuestionType } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class CreateQuestionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsObject()
  item!: Record<string, unknown>;
}
