import "reflect-metadata";
import { Logger, LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";
import { EmailWorkerService } from "./email/email-worker.service";
import { getEnvironment } from "./config/environment";

const logLevels: Record<string, LogLevel[]> = {
  error: ["error"],
  warn: ["error", "warn"],
  log: ["error", "warn", "log"],
  debug: ["error", "warn", "log", "debug"],
  verbose: ["error", "warn", "log", "debug", "verbose"],
};

async function bootstrap() {
  const environment = getEnvironment();
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: logLevels[environment.LOG_LEVEL],
  });

  const worker = app.get(EmailWorkerService);
  const shutdown = async () => {
    worker.stop();
    await app.close();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  try {
    await worker.run();
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure";
  Logger.error(message, undefined, "WorkerBootstrap");
  process.exitCode = 1;
});
