import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { IsIn, IsInt, Min } from 'class-validator';
import { CandidateStagesService } from './candidate-stages.service';
import { ReviewerAuth } from './reviewer-auth';
import { WorkflowStatus, WORKFLOW_STATUSES } from './stage-policy';

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
  list(@Param('positionId') positionId: string) {
    return this.stages.list(positionId, this.auth.current());
  }

  @Get(':assignmentId/history')
  history(@Param('positionId') positionId: string, @Param('assignmentId') assignmentId: string) {
    return this.stages.history(positionId, assignmentId);
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
}
