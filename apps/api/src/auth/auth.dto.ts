import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class RegisterDto {
  @IsString() @MinLength(1) name!: string;
  @IsEmail() email!: string;
  @MinLength(12) password!: string;
}
export class CreateInternalUserDto extends RegisterDto {
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsArray() @IsString({ each: true }) departmentIds?: string[];
}
export class UpdateInternalUserDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(12) password?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) departmentIds?: string[];
}
export class AssignDepartmentsDto {
  @IsArray() @IsString({ each: true }) departmentIds!: string[];
}
