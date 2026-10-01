import { Body, Controller, Get, Headers, NotFoundException, Param, Post, StreamableFile } from "@nestjs/common";
import { Public } from "../auth/access.decorator";
import { TestsService } from "../tests/tests.service";
import { QuestionsService } from "../questions/questions.service";
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
    private readonly tests: TestsService,
    private readonly questions: QuestionsService,
  ) {}

  @Public()
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

  @Public()
  @Get("invite/:inviteToken/welcome")
  welcome(
    @Param("inviteToken") inviteToken: string,
  ) {
    return this.attempts.getInvitationWelcome(inviteToken);
  }

  @Public()
  @Get('invite/:inviteToken/test')
  async candidateTest(@Param('inviteToken') token: string) {
    const invitation = await this.attempts.resolveInviteToken(token);
    const test = await this.tests.getTest(invitation.testId);
    return { ...test, questions: test.questions.map(question => ({
      ...question,
      item: question.type === 'MULTIPLE_CHOICE'
        ? { ...question.item, options: ((question.item.options ?? []) as Array<Record<string, unknown>>).map(option => { const safe = { ...option }; delete safe.isCorrect; return safe; }) }
        : question.type === 'SHORT_ANSWER'
          ? { ...question.item, answerHint: undefined }
          : question.item,
    })) };
  }

  @Public()
  @Get('invite/:inviteToken/questions/:questionId/video')
  async candidateQuestionVideo(@Param('inviteToken') token: string, @Param('questionId') questionId: string) {
    const { testId } = await this.attempts.resolveInviteToken(token);
    const test = await this.tests.getTest(testId);
    if (!test.questions.some(question => question.id === questionId)) throw new NotFoundException('Question not in invitation');
    const result = await this.questions.getVideo(questionId);
    return new StreamableFile(result.file.stream, { type: result.asset.mimeType, disposition: 'inline', length: result.file.contentLength });
  }

  @Public()
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

  @Public()
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

  @Public()
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

  @Public()
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
