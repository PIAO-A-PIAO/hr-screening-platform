import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CandidateStagesService } from "./candidate-stages.service";
import { allowedTransitions } from "./stage-policy";

describe("candidate workflow policy", () => {
  it("uses the four Stage 2 statuses", () => {
    expect(allowedTransitions("INVITED")).toEqual(["DISCARDED"]);
    expect(allowedTransitions("TO_EVALUATE")).toEqual(["SHORTLISTED", "DISCARDED"]);
    expect(allowedTransitions("SHORTLISTED")).toEqual(["TO_EVALUATE", "DISCARDED"]);
    expect(allowedTransitions("DISCARDED")).toEqual([]);
  });
});

describe("candidate workflow service", () => {
  const reviewer = { id: "r1", name: "Reviewer One" };
  const row = {
    id: "i1", workflowStatus: "TO_EVALUATE", workflowRevision: 0,
    inviteToken: "token", invitedAt: new Date(),
    candidate: { id: "c1", name: "Candidate", email: "candidate@example.com" },
    attempt: { id: "a1", status: "SUBMITTED", submittedAt: new Date(), scoreSum: 0 },
  };

  function setup() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "i1" }]),
      interview: {
        findFirst: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([row]), deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      interviewStatusChange: {
        create: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({ id: "h1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      emailTask: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      position: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
    };
    const prisma = { ...tx, $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
    return { tx, service: new CandidateStagesService(prisma as unknown as PrismaService) };
  }

  it("counts interviews by the four workflow statuses", async () => {
    const { service } = setup();
    const result = await service.list("p1", reviewer);
    expect(result.counts).toEqual({ INVITED: 0, TO_EVALUATE: 1, SHORTLISTED: 0, DISCARDED: 0 });
  });

  it("rejects an interview from another position", async () => {
    const { service, tx } = setup();
    tx.interview.findFirst.mockResolvedValue(null);
    await expect(service.change("other", "i1", { stage: "SHORTLISTED", expectedStage: "TO_EVALUATE", expectedRevision: 0 }, reviewer)).rejects.toThrow(NotFoundException);
  });

  it("writes the workflow change and audit together", async () => {
    const { service, tx } = setup();
    const result = await service.change("p1", "i1", { stage: "SHORTLISTED", expectedStage: "TO_EVALUATE", expectedRevision: 0 }, reviewer);
    expect(tx.interview.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { workflowStatus: "SHORTLISTED", workflowRevision: { increment: 1 } } });
    expect(result).toMatchObject({ assignmentId: "i1", fromStage: "TO_EVALUATE", toStage: "SHORTLISTED" });
  });

  it("rejects stale and invalid transitions", async () => {
    const { service } = setup();
    await expect(service.change("p1", "i1", { stage: "SHORTLISTED", expectedStage: "TO_EVALUATE", expectedRevision: 1 }, reviewer)).rejects.toThrow(ConflictException);
    await expect(service.change("p1", "i1", { stage: "INVITED", expectedStage: "TO_EVALUATE", expectedRevision: 0 }, reviewer)).rejects.toThrow(BadRequestException);
  });

  it("cancels pending reminders when discarded", async () => {
    const { service, tx } = setup();
    await service.change("p1", "i1", { stage: "DISCARDED", expectedStage: "TO_EVALUATE", expectedRevision: 0 }, reviewer);
    expect(tx.emailTask.updateMany.mock.calls[0][0].where).toEqual({ interviewId: "i1", status: "PENDING" });
  });
});
