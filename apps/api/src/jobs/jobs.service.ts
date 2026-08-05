import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { weightedScore } from "../common/scoring";
import { AddCandidateDto, CreateJobDto } from "./dto";

const jobInclude = {
  template: { include: { questions: { orderBy: { sortOrder: "asc" as const } } } },
  applications: {
    orderBy: { createdAt: "desc" as const },
    include: {
      candidate: true,
      answers: { include: { question: true, ratings: true } },
      reviews: { include: { reviewer: true } },
    },
  },
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const jobs = await this.prisma.job.findMany({ orderBy: { createdAt: "desc" }, include: jobInclude });
    return jobs.map((job) => ({
      ...job,
      candidateCount: job.applications.length,
      questionCount: job.template?.questions.length ?? 0,
      applications: undefined,
    }));
  }

  async get(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: jobInclude });
    if (!job) throw new NotFoundException("Job not found");
    return {
      ...job,
      applications: job.applications.map((application) => ({
        ...application,
        collectiveScore: weightedScore(application.answers.flatMap((answer) =>
          answer.ratings.map((rating) => ({
            questionId: answer.questionId,
            weight: answer.question.weight,
            rating: rating.rating,
          })),
        )),
      })),
    };
  }

  create(input: CreateJobDto) {
    return this.prisma.job.create({
      data: {
        ...input,
        template: { create: { title: `${input.title} interview` } },
      },
      include: { template: true },
    });
  }

  async addCandidate(jobId: string, input: AddCandidateDto) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { template: true } });
    if (!job) throw new NotFoundException("Job not found");
    if (!job.template?.isPublished) throw new ConflictException("Publish the interview before inviting candidates");
    const existing = await this.prisma.application.findFirst({ where: { jobId, candidate: { email: input.email } } });
    if (existing) throw new ConflictException("This candidate already has an invitation for the job");

    const candidate = await this.prisma.candidate.create({ data: input });
    return this.prisma.application.create({
      data: {
        jobId,
        candidateId: candidate.id,
        inviteToken: randomBytes(24).toString("base64url"),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      include: { candidate: true },
    });
  }
}
