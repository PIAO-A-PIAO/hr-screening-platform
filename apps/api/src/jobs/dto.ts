import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";

export class CreateJobDto {
  @IsString() @Length(2, 150) title!: string;
  @IsString() @Length(2, 100) department!: string;
  @IsOptional() @IsString() @MaxLength(150) location?: string;
  @IsString() @MinLength(10) description!: string;
}

export class AddCandidateDto {
  @IsString() @Length(1, 100) firstName!: string;
  @IsString() @Length(1, 100) lastName!: string;
  @IsEmail() email!: string;
}
