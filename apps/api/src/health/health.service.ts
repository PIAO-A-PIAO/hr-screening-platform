import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageReadinessService } from "./storage-readiness.service";

export type ReadinessResult = {
  status: "ready" | "not_ready";
  checks: {
    database: boolean;
    storage: boolean;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageReadinessService,
  ) {}

  async readiness(): Promise<ReadinessResult> {
    const [database, storage] = await Promise.allSettled([
      this.prisma.isReady(),
      this.storage.isReady(),
    ]);
    const checks = {
      database: database.status === "fulfilled" && database.value === true,
      storage: storage.status === "fulfilled" && storage.value === true,
    };

    return {
      status: checks.database && checks.storage ? "ready" : "not_ready",
      checks,
    };
  }
}
