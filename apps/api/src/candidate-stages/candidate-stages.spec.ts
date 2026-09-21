import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CandidateStagesService } from "./candidate-stages.service";
import { CandidatePipelineSort } from "./candidate-stages.dto";
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
    emailTasks: [{
      id: "e1", subject: "Interview complete", sentAt: new Date(), sequenceStepOrder: 2,
      template: { key: "completion", name: "Completion email" },
    }],
  };

  function setup() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "i1" }]),
      interview: {
        findFirst: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([row]), deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        groupBy: jest.fn().mockResolvedValue([{ workflowStatus: "TO_EVALUATE", _count: { _all: 1 } }]),
        findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(row),
      },
      interviewStatusChange: {
        create: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({ id: "h1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      emailTask: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      position: { findUnique: jest.fn().mockResolvedValue({ id: "p1", status: "OPEN", test: { id: "t1" } }) },
      candidate: { upsert: jest.fn().mockResolvedValue({ id: "c1", name: "Candidate", email: "candidate@example.com" }) },
    };
    const prisma = { ...tx, $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
    const email = { queueInvitationEmail: jest.fn().mockResolvedValue({ id: "email-1" }) };
    return { tx, email, service: new CandidateStagesService(prisma as unknown as PrismaService, email as never) };
  }

  it("counts interviews by the four workflow statuses", async () => {
    const { service } = setup();
    const result = await service.list("p1", { status: "TO_EVALUATE" }, reviewer);
    expect(result.counts).toEqual({ INVITED: 0, TO_EVALUATE: 1, SHORTLISTED: 0, DISCARDED: 0 });
    expect(result.interviews[0].emailHistory[0]).toMatchObject({
      type: "completion", templateName: "Completion email", subject: "Interview complete",
    });
  });

  it("defaults to invited candidates newest first", async () => {
    const { service, tx } = setup();
    await service.list("p1", {}, reviewer);
    expect(tx.interview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { positionId: "p1", workflowStatus: "INVITED" },
      orderBy: [{ invitedAt: "desc" }, { id: "asc" }],
    }));
  });

  it("filters by candidate name and supports alphabetical sorting", async () => {
    const { service, tx } = setup();
    await service.list("p1", {
      status: "SHORTLISTED", search: "  cand  ", sort: CandidatePipelineSort.NAME_ASC,
    }, reviewer);
    expect(tx.interview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        positionId: "p1",
        workflowStatus: "SHORTLISTED",
        candidate: { name: { contains: "cand", mode: "insensitive" } },
      },
      orderBy: [{ candidate: { name: "asc" } }, { invitedAt: "desc" }],
    }));
  });

  it("loads one interview in the selected position", async () => {
    const { service } = setup();
    const result = await service.get("p1", "i1");
    expect(result).toMatchObject({ id: "i1", candidate: { id: "c1" } });
  });

  it("creates a duplicate-safe invitation and queues its email", async () => {
    const { service, tx, email } = setup();
    const result = await service.invite("p1", {
      firstName: " Candidate ", lastName: " Person ", email: " CANDIDATE@EXAMPLE.COM ",
    });
    expect(result.created).toBe(true);
    expect(tx.candidate.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "candidate@example.com" } }));
    expect(email.queueInvitationEmail).toHaveBeenCalledWith(tx, { assignmentId: "i1" });
  });

  it("does not create or email a duplicate interview", async () => {
    const { service, tx, email } = setup();
    tx.interview.findUnique.mockResolvedValue(row);
    const result = await service.invite("p1", {
      firstName: "Candidate", lastName: "Person", email: "candidate@example.com",
    });
    expect(result.created).toBe(false);
    expect(tx.interview.create).not.toHaveBeenCalled();
    expect(email.queueInvitationEmail).not.toHaveBeenCalled();
  });

  it("imports valid rows and reports invalid and duplicate CSV rows", async () => {
    const { service } = setup();
    const result = await service.importCandidates("p1", { rows: [
      { row: 2, name: "Jane Smith", email: "jane@example.com" },
      { row: 3, name: "Jane Duplicate", email: "JANE@example.com" },
      { row: 4, name: "Missing Email", email: "invalid" },
    ] });
    expect(result).toMatchObject({ totalRows: 3, imported: 1, skipped: 1, invalid: 1 });
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
