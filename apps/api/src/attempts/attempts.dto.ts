import { IsString, MinLength } from "class-validator";

export type ResolveInviteTokenResponse = {
  assignmentId: string;
  testId: string;
  userId: string;
};

export class StartAttemptDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  testId!: string;
}