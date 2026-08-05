import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AddCandidateDto, CreateJobDto } from "./dto";
import { JobsService } from "./jobs.service";

@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list() {
    return this.jobs.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.jobs.get(id);
  }

  @Post()
  create(@Body() input: CreateJobDto) {
    return this.jobs.create(input);
  }

  @Post(":id/candidates")
  addCandidate(@Param("id") id: string, @Body() input: AddCandidateDto) {
    return this.jobs.addCandidate(id, input);
  }
}
