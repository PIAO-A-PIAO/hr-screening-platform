import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export enum PositionStatusDto {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum PositionSortDto {
  CREATED_DESC = "CREATED_DESC",
  CREATED_ASC = "CREATED_ASC",
  TITLE_ASC = "TITLE_ASC",
}

export class ListPositionsQueryDto {
  @IsOptional()
  @IsEnum(PositionStatusDto)
  status?: PositionStatusDto;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsEnum(PositionSortDto)
  sort?: PositionSortDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CreatePositionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsEnum(PositionStatusDto)
  status?: PositionStatusDto;
}

export class UpdatePositionStatusDto {
  @IsEnum(PositionStatusDto)
  status!: PositionStatusDto;
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
