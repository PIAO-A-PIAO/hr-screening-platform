import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { StorageReadinessService } from "./storage-readiness.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, StorageReadinessService],
})
export class HealthModule {}
