import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class AnswerRatingDto {
  @IsString() answerId!: string;
  @IsString() questionId!: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(5000) note?: string;
  @IsOptional() @IsString() @MaxLength(20000) transcript?: string;
}

export class SubmitReviewDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => AnswerRatingDto) ratings!: AnswerRatingDto[];
  @IsOptional() @IsString() @MaxLength(10000) overallNotes?: string;
}
