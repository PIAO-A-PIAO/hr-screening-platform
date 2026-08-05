import { ApplicationStatus, JobStatus, PrismaClient, QuestionType, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const recruiter = await prisma.user.upsert({
    where: { email: "recruiter@demo.local" },
    update: {},
    create: { id: "demo-recruiter", email: "recruiter@demo.local", name: "Richik Recruiter", role: UserRole.RECRUITER },
  });
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@demo.local" },
    update: {},
    create: { id: "demo-reviewer", email: "reviewer@demo.local", name: "Sam Reviewer", role: UserRole.REVIEWER },
  });

  const job = await prisma.job.upsert({
    where: { id: "demo-job" },
    update: {},
    create: {
      id: "demo-job",
      title: "Software Engineer",
      department: "Engineering",
      location: "Toronto / Hybrid",
      description: "Build reliable internal products, collaborate with hardware and operations teams, and improve our engineering platform.",
      status: JobStatus.OPEN,
    },
  });
  const template = await prisma.interviewTemplate.upsert({
    where: { jobId: job.id },
    update: { isPublished: true },
    create: {
      id: "demo-template",
      jobId: job.id,
      title: "Software Engineer interview",
      welcomeText: "Welcome. You can save each answer before submitting the complete interview. For video questions, allow browser camera and microphone access.",
      isPublished: true,
    },
  });

  const questions = await Promise.all([
    prisma.question.upsert({
      where: { id: "demo-question-text" }, update: {},
      create: { id: "demo-question-text", templateId: template.id, type: QuestionType.TEXT, prompt: "Describe a production issue you diagnosed and how you found the root cause.", weight: 2, sortOrder: 0 },
    }),
    prisma.question.upsert({
      where: { id: "demo-question-mcq" }, update: {},
      create: { id: "demo-question-mcq", templateId: template.id, type: QuestionType.SINGLE_CHOICE, prompt: "Which database is the best fit for strongly relational hiring workflow data?", options: ["PostgreSQL", "Object storage", "Redis only", "A log file"], weight: 1, sortOrder: 1 },
    }),
    prisma.question.upsert({
      where: { id: "demo-question-video" }, update: {},
      create: { id: "demo-question-video", templateId: template.id, type: QuestionType.VIDEO, prompt: "Tell us about a technical decision where you balanced speed, quality, and future extensibility.", helpText: "Use a concrete example and explain the trade-off.", weight: 4, sortOrder: 2, preparationSeconds: 15, answerSeconds: 90, maxRetries: 1 },
    }),
  ]);

  const candidate = await prisma.candidate.upsert({
    where: { id: "demo-candidate" }, update: {},
    create: { id: "demo-candidate", firstName: "Alex", lastName: "Morgan", email: "alex@example.com" },
  });
  const application = await prisma.application.upsert({
    where: { inviteToken: "demo-candidate-token" },
    update: {},
    create: {
      id: "demo-application",
      jobId: job.id,
      candidateId: candidate.id,
      inviteToken: "demo-candidate-token",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  });

  const textAnswer = await prisma.answer.upsert({
    where: { applicationId_questionId: { applicationId: application.id, questionId: questions[0].id } },
    update: {},
    create: { applicationId: application.id, questionId: questions[0].id, textValue: "A device status service began timing out under load. I compared request latency with database query timing, reproduced the issue with a realistic data set, and found an unindexed filter used by the dashboard. I added the index, bounded the query, and created a regression test and latency alert." },
  });
  const mcqAnswer = await prisma.answer.upsert({
    where: { applicationId_questionId: { applicationId: application.id, questionId: questions[1].id } },
    update: {},
    create: { applicationId: application.id, questionId: questions[1].id, jsonValue: ["PostgreSQL"] },
  });
  const videoAnswer = await prisma.answer.upsert({
    where: { applicationId_questionId: { applicationId: application.id, questionId: questions[2].id } },
    update: {},
    create: {
      applicationId: application.id,
      questionId: questions[2].id,
      mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
      transcript: "I chose a small modular service instead of splitting the system into several deployables immediately. The boundaries were explicit, so the team could move quickly while keeping a clear path to extract the media worker when volume justified it.",
    },
  });

  const review = await prisma.review.upsert({
    where: { applicationId_reviewerId: { applicationId: application.id, reviewerId: reviewer.id } },
    update: {},
    create: { applicationId: application.id, reviewerId: reviewer.id, overallNotes: "Clear examples and good awareness of operational trade-offs.", submittedAt: new Date() },
  });
  for (const rating of [
    { answer: textAnswer, question: questions[0], rating: 4.5, note: "Specific diagnosis and measurable fix." },
    { answer: mcqAnswer, question: questions[1], rating: 5, note: "Correct choice." },
    { answer: videoAnswer, question: questions[2], rating: 4, note: "Pragmatic architecture decision." },
  ]) {
    await prisma.answerRating.upsert({
      where: { reviewId_answerId: { reviewId: review.id, answerId: rating.answer.id } },
      update: {},
      create: { reviewId: review.id, answerId: rating.answer.id, questionId: rating.question.id, rating: rating.rating, note: rating.note },
    });
  }

  console.log(`Seeded demo workspace for ${recruiter.email}`);
  console.log("Candidate interview: http://localhost:3000/interview/demo-candidate-token");
}

main().finally(async () => prisma.$disconnect());
