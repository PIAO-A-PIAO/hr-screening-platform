import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export enum PositionStatusDto {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  ON_HOLD = "ON_HOLD",
  CLOSED = "CLOSED",
}

export class CreatePositionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  department!: string;

  @IsString()
  location!: string;

  @IsOptional()
  @IsEnum(PositionStatusDto)
  status?: PositionStatusDto;

  @IsString()
  owner!: string;
}

export enum EmailDelayUnitDto {
  MINUTES = "MINUTES",
  HOURS = "HOURS",
  DAYS = "DAYS",
}

export enum EmailSequenceStopConditionDto {
  CANDIDATE_SUBMITTED = "CANDIDATE_SUBMITTED",
  CANDIDATE_DISCARDED = "CANDIDATE_DISCARDED",
  POSITION_CLOSED = "POSITION_CLOSED",
}

export class UpdatePositionEmailSequenceStepDto {
  @IsString()
  templateId!: string;

  @IsInt()
  @Min(1)
  delayValue!: number;

  @IsEnum(EmailDelayUnitDto)
  delayUnit!: EmailDelayUnitDto;

  @IsInt()
  @Min(1)
  order!: number;

  @IsOptional()
  @IsEnum(EmailSequenceStopConditionDto)
  stopCondition?: EmailSequenceStopConditionDto;
}

export class UpdatePositionEmailSequenceDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => UpdatePositionEmailSequenceStepDto)
  steps!: UpdatePositionEmailSequenceStepDto[];
}
