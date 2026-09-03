import { IsEnum, IsOptional, IsString } from "class-validator";

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
