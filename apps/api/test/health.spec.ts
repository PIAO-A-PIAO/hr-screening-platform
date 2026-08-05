import { PrismaService } from "../src/prisma/prisma.service";
import { HealthService } from "../src/health/health.service";
import { StorageReadinessService } from "../src/health/storage-readiness.service";

function createHealthService(databaseReady: boolean, storageReady: boolean) {
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
  it.each([
    [true, true, "ready"],
    [false, true, "not_ready"],
    [true, false, "not_ready"],
    [false, false, "not_ready"],
  ] as const)(
    "reports database=%s and storage=%s as %s",
    async (databaseReady, storageReady, status) => {
      await expect(createHealthService(databaseReady, storageReady).readiness())
        .resolves.toMatchObject({
          status,
          checks: { database: databaseReady, storage: storageReady },
        });
    },
  );
});
