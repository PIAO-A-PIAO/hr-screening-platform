import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ApplicationStatus } from "@prisma/client";
import { weightedScore } from "../common/scoring";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitReviewDto } from "./dto";

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(applicationId: string, reviewerId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: true,
        answers: {
          orderBy: { question: { sortOrder: "asc" } },
          include: { question: true, ratings: { include: { review: { include: { reviewer: true } } } } },
        },
        reviews: { include: { reviewer: true, ratings: true } },
      },
    });
    if (!application) throw new NotFoundException("Application not found");
    return {
      ...application,
      currentReview: application.reviews.find((review) => review.reviewerId === reviewerId) ?? null,
      collectiveScore: weightedScore(application.answers.flatMap((answer) =>
        answer.ratings.map((rating) => ({ questionId: answer.questionId, weight: answer.question.weight, rating: rating.rating })),
      )),
    };
  }

  async submit(applicationId: string, reviewerId: string, input: SubmitReviewDto) {
    if (input.ratings.some(({ rating }) => rating * 2 !== Math.round(rating * 2))) {
      throw new BadRequestException("Ratings must use 0.5 increments");
    }
    const answers = await this.prisma.answer.findMany({ where: { applicationId }, include: { question: true } });
    if (!answers.length) throw new BadRequestException("This application has no answers to review");
    const answerIds = new Set(answers.map((answer) => answer.id));
    if (input.ratings.some((rating) => !answerIds.has(rating.answerId))) {
      throw new BadRequestException("A rating references an answer outside this application");
    }

    return this.prisma.$transaction(async (transaction) => {
      const review = await transaction.review.upsert({
        where: { applicationId_reviewerId: { applicationId, reviewerId } },
        create: { applicationId, reviewerId, overallNotes: input.overallNotes, submittedAt: new Date() },
        update: { overallNotes: input.overallNotes, submittedAt: new Date() },
      });
      for (const rating of input.ratings) {
        await transaction.answerRating.upsert({
          where: { reviewId_answerId: { reviewId: review.id, answerId: rating.answerId } },
          create: {
            reviewId: review.id,
            answerId: rating.answerId,
            questionId: rating.questionId,
            rating: rating.rating,
            note: rating.note,
          },
          update: { rating: rating.rating, note: rating.note },
        });
        if (rating.transcript !== undefined) {
          await transaction.answer.update({ where: { id: rating.answerId }, data: { transcript: rating.transcript } });
        }
      }
      await transaction.application.update({ where: { id: applicationId }, data: { status: ApplicationStatus.REVIEWED } });
      return review;
    });
  }
}
