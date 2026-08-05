import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { SubmitReviewDto } from "./dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("reviews")
@Controller("applications/:applicationId/review")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  get(@Param("applicationId") applicationId: string, @CurrentUser() user: User) {
    return this.reviews.get(applicationId, user.id);
  }

  @Post()
  submit(@Param("applicationId") applicationId: string, @CurrentUser() user: User, @Body() input: SubmitReviewDto) {
    return this.reviews.submit(applicationId, user.id, input);
  }
}
