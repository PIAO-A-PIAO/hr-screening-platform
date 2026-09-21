import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, Min } from 'class-validator';
import { CandidateStagesService } from './candidate-stages.service';
import { ReviewerAuth } from './reviewer-auth';
import { WorkflowStatus, WORKFLOW_STATUSES } from './stage-policy';
import { ImportPositionCandidatesDto, InvitePositionCandidateDto, ListCandidatePipelineDto, SaveResponseFeedbackDto } from './candidate-stages.dto';

export class ChangeStageDto {
  @IsIn(WORKFLOW_STATUSES)
  stage!: WorkflowStatus;

  @IsIn(WORKFLOW_STATUSES)
  expectedStage!: WorkflowStatus;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
@Controller('positions/:positionId/candidates')
export class CandidateStagesController {
  constructor(private readonly stages: CandidateStagesService, private readonly auth: ReviewerAuth) {}

  @Get()
  list(@Param('positionId') positionId: string, @Query() query: ListCandidatePipelineDto) {
    return this.stages.list(positionId, query, this.auth.current());
  }

  @Get(':assignmentId/history')
  history(@Param('positionId') positionId: string, @Param('assignmentId') assignmentId: string) {
    return this.stages.history(positionId, assignmentId);
  }

  @Get(':interviewId')
  get(@Param('positionId') positionId: string, @Param('interviewId') interviewId: string) {
    return this.stages.get(positionId, interviewId);
  }

  @Post('invite')
  invite(@Param('positionId') positionId: string, @Body() body: InvitePositionCandidateDto) {
    return this.stages.invite(positionId, body);
  }

  @Post('import')
  importCandidates(@Param('positionId') positionId: string, @Body() body: ImportPositionCandidatesDto) {
    return this.stages.importCandidates(positionId, body);
  }

  @Delete(':assignmentId')
  remove(@Param('positionId') positionId: string, @Param('assignmentId') assignmentId: string) {
    return this.stages.remove(positionId, assignmentId);
  }

  @Patch(':assignmentId/stage')
  change(@Param('positionId') positionId: string, @Param('assignmentId') assignmentId: string,
    @Body() body: ChangeStageDto) {
    return this.stages.change(positionId, assignmentId, body, this.auth.current());
  }

  @Patch(':assignmentId/status')
  changeStatus(@Param('positionId') positionId: string, @Param('assignmentId') assignmentId: string,
    @Body() body: ChangeStageDto) {
    return this.stages.change(positionId, assignmentId, body, this.auth.current());
  }

  @Patch(':interviewId/responses/:responseId/feedback')
  saveFeedback(
    @Param('positionId') positionId: string,
    @Param('interviewId') interviewId: string,
    @Param('responseId') responseId: string,
    @Body() body: SaveResponseFeedbackDto,
  ) {
    return this.stages.saveFeedback(positionId, interviewId, responseId, body);
  }
}
