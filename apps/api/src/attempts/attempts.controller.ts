import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreateResponseDto } from "../responses/responses.dto";
import { StartAttemptDto } from "./attempts.dto";
import { AttemptsService } from "./attempts.service";

@ApiTags("attempts")
@ApiHeader({
  name: "x-invite-token",
  required: false,
  description:
    "Secure invitation token required for candidate attempt operations",
})
@Controller("attempts")
export class AttemptsController {
  constructor(
    private readonly attempts: AttemptsService,
  ) {}

  @Get("invite/:inviteToken")
  @ApiOperation({
    summary:
      "Resolve and validate an invitation token",
  })
  @ApiParam({
    name: "inviteToken",
  })
  resolveInviteToken(
    @Param("inviteToken") inviteToken: string,
  ) {
    return this.attempts.resolveInviteToken(
      inviteToken,
    );
  }

  @Post("start")
  @ApiOperation({
    summary:
      "Start or resume one test attempt using an invitation",
  })
  startAttempt(
    @Body() dto: StartAttemptDto,
    @Headers("x-invite-token")
    inviteToken?: string,
  ) {
    return this.attempts.startAttempt(
      dto,
      inviteToken,
    );
  }

  @Post(":attemptId/save")
  @ApiOperation({
    summary:
      "Save one response within an authorized attempt",
  })
  @ApiParam({
    name: "attemptId",
  })
  saveAttemptResponse(
    @Param("attemptId") attemptId: string,
    @Body() dto: CreateResponseDto,
    @Headers("x-invite-token")
    inviteToken?: string,
  ) {
    return this.attempts.saveAttemptResponse(
      attemptId,
      dto,
      inviteToken,
    );
  }

  @Post(":attemptId/submit")
  @ApiOperation({
    summary:
      "Submit one authorized attempt",
  })
  @ApiParam({
    name: "attemptId",
  })
  submitAttempt(
    @Param("attemptId") attemptId: string,
    @Headers("x-invite-token")
    inviteToken?: string,
  ) {
    return this.attempts.submitAttempt(
      attemptId,
      inviteToken,
    );
  }

  @Get(":attemptId")
  @ApiOperation({
    summary:
      "Retrieve one authorized candidate attempt",
  })
  @ApiParam({
    name: "attemptId",
  })
  getAttempt(
    @Param("attemptId") attemptId: string,
    @Headers("x-invite-token")
    inviteToken?: string,
  ) {
    return this.attempts.getAttempt(
      attemptId,
      inviteToken,
    );
  }

  @Get("test/:testId")
  @ApiOperation({
    summary:
      "List all attempts for one test",
  })
  @ApiParam({
    name: "testId",
  })
  listAttemptsForTest(
    @Param("testId") testId: string,
  ) {
    return this.attempts.listAttemptsForTest(
      testId,
    );
  }
}