import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateEmailTemplateDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  html!: string;

  @IsOptional()
  @IsString()
  text?: string;
}

export class UpdateEmailTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  html!: string;

  @IsOptional()
  @IsString()
  text?: string;
}
