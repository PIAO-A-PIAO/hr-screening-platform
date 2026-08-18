import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export enum UserRoleDto {
  RECRUITER = "RECRUITER",
  CANDIDATE = "CANDIDATE",
}

export enum UserStatusDto {
  NOT_INVITED = "NOT_INVITED",
  INVITED = "INVITED",
  TO_BE_EVALUATED = "TO_BE_EVALUATED",
  STAGE_1 = "STAGE_1",
  STAGE_2 = "STAGE_2",
  STAGE_3 = "STAGE_3",
  SHORTLISTED = "SHORTLISTED",
  DISCARDED = "DISCARDED",
  HIRED = "HIRED",
  ON_HOLD = "ON_HOLD",
}

export class UserSeedDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(UserRoleDto)
  role?: UserRoleDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(UserStatusDto, { each: true })
  status?: UserStatusDto[];
}

export class GenerateUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UserSeedDto)
  users!: UserSeedDto[];
}

export class InviteUserDto extends UserSeedDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  testIds?: string[];
}

export class InviteUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InviteUserDto)
  users!: InviteUserDto[];
}

export class UpdateUserStatusDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(UserStatusDto, { each: true })
  status!: UserStatusDto[];
}
