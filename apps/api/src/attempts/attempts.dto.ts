import { IsString } from "class-validator";

export type ResolveInviteTokenResponse = {
  assignmentId: string;
  testId: string;
  userId: string;
};

export class StartAttemptDto {
  @IsString()
  userId!: string;

  @IsString()
  testId!: string;
}
