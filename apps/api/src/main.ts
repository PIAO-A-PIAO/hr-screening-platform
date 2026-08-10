import "reflect-metadata";
import { mkdirSync } from "node:fs";
import { Logger, LogLevel, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { getEnvironment, resolveFromRepository } from "./config/environment";

const logLevels: Record<string, LogLevel[]> = {
  error: ["error"],
  warn: ["error", "warn"],
  log: ["error", "warn", "log"],
  debug: ["error", "warn", "log", "debug"],
  verbose: ["error", "warn", "log", "debug", "verbose"],
};

async function bootstrap() {
  const environment = getEnvironment();
  if (environment.STORAGE_DRIVER === "filesystem") {
  mkdirSync(resolveFromRepository(environment.STORAGE_DIR), { recursive: true });
 }

  const app = await NestFactory.create(AppModule, {
    logger: logLevels[environment.LOG_LEVEL],
  });

  app.setGlobalPrefix("api");
  app.enableCors({ origin: environment.WEB_ORIGINS, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("DS-HR Foundation API")
    .setDescription("Milestone 0 infrastructure only; no recruitment domain endpoints yet")
    .setVersion("0.0.0")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(environment.API_PORT, "0.0.0.0");
  Logger.log(
    `API listening on port ${environment.API_PORT} (${environment.APP_ENV})`,
    "Bootstrap",
  );
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure";
  Logger.error(message, undefined, "Bootstrap");
  process.exitCode = 1;
});
