import { IsOptional, IsString } from "class-validator";

export class CreateEmailTemplateDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsString()
  html!: string;

  @IsOptional()
  @IsString()
  text?: string;
}

export class UpdateEmailTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsString()
  html!: string;

  @IsOptional()
  @IsString()
  text?: string;
}
