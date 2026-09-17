import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { WorkflowStatus, WORKFLOW_STATUSES } from "./stage-policy";

export enum CandidatePipelineSort {
  INVITED_DESC = "INVITED_DESC",
  INVITED_ASC = "INVITED_ASC",
  NAME_ASC = "NAME_ASC",
}

export class ListCandidatePipelineDto {
  @IsOptional()
  @IsIn(WORKFLOW_STATUSES)
  status?: WorkflowStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CandidatePipelineSort)
  sort?: CandidatePipelineSort;
}

export class InvitePositionCandidateDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;
}

export class ImportPositionCandidateRowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  email!: string;

  @IsOptional()
  row?: number;
}

export class ImportPositionCandidatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportPositionCandidateRowDto)
  rows!: ImportPositionCandidateRowDto[];
}
