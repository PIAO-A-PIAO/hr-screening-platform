import { HealthService } from "../src/health/health.service";
import { StorageReadinessService } from "../src/health/storage-readiness.service";
import { PrismaService } from "../src/prisma/prisma.service";

function createService(databaseReady: boolean, storageReady: boolean) {
  const prisma = {
    isReady: jest.fn().mockImplementation(async () => {
      if (!databaseReady) throw new Error("database unavailable");
      return true;
    }),
  } as unknown as PrismaService;
  const storage = {
    isReady: jest.fn().mockImplementation(async () => {
      if (!storageReady) throw new Error("storage unavailable");
      return true;
    }),
  } as unknown as StorageReadinessService;
  return new HealthService(prisma, storage);
}

describe("HealthService", () => {
  it("is ready only when both dependencies are ready", async () => {
    await expect(createService(true, true).readiness()).resolves.toEqual({
      status: "ready",
      checks: { database: true, storage: true },
    });
  });

  it.each([
    [false, true, { database: false, storage: true }],
    [true, false, { database: true, storage: false }],
    [false, false, { database: false, storage: false }],
  ])("reports unavailable dependencies", async (database, storage, checks) => {
    await expect(createService(database, storage).readiness()).resolves.toEqual({
      status: "not_ready",
      checks,
    });
  });
});
