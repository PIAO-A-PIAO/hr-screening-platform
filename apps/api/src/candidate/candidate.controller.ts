import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import { CandidateService } from "./candidate.service";
import { SaveAnswerDto } from "./dto";

@Public()
@ApiTags("candidate interview")
@Controller("public/interviews/:token")
export class CandidateController {
  constructor(private readonly candidate: CandidateService) {}

  @Get()
  get(@Param("token") token: string) {
    return this.candidate.getInterview(token);
  }

  @Put("answers/:questionId")
  saveAnswer(@Param("token") token: string, @Param("questionId") questionId: string, @Body() input: SaveAnswerDto) {
    return this.candidate.saveAnswer(token, questionId, input);
  }

  @Post("submit")
  submit(@Param("token") token: string) {
    return this.candidate.submit(token);
  }
}
