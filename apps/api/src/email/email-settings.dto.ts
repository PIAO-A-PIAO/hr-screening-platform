import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateEmailSettingsDto {
  @IsOptional() @IsString() smtpHost?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) smtpPort?: number;
  @IsOptional() @IsBoolean() smtpSecure?: boolean;
  @IsOptional() @IsString() smtpUser?: string;
  // Replace-only: the GET response reports passwordConfigured, never this value.
  @IsOptional() @IsString() smtpPassword?: string;
  @IsOptional() @IsEmail() emailFrom?: string;
}
