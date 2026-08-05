import { Body, Controller, Delete, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateQuestionDto } from "./dto";
import { InterviewsService } from "./interviews.service";

@ApiTags("interview builder")
@Controller("jobs/:jobId/interview")
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Post("questions")
  addQuestion(@Param("jobId") jobId: string, @Body() input: CreateQuestionDto) {
    return this.interviews.addQuestion(jobId, input);
  }

  @Delete("questions/:questionId")
  removeQuestion(@Param("jobId") jobId: string, @Param("questionId") questionId: string) {
    return this.interviews.removeQuestion(jobId, questionId);
  }

  @Post("publish")
  publish(@Param("jobId") jobId: string) {
    return this.interviews.publish(jobId);
  }
}
