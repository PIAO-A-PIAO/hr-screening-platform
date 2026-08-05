import { IsArray, IsOptional, IsString, IsUrl } from "class-validator";

export class SaveAnswerDto {
  @IsOptional() @IsString() textValue?: string;
  @IsOptional() @IsArray() jsonValue?: string[];
  @IsOptional() @IsUrl({ require_tld: false }) mediaUrl?: string;
}
