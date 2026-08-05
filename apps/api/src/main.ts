import "reflect-metadata";
import { mkdirSync } from "node:fs";
import { Logger, LogLevel, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels[environment.LOG_LEVEL],
  });
  const uploadDir = resolveFromRepository(environment.UPLOAD_DIR);
  mkdirSync(uploadDir, { recursive: true });

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: environment.WEB_ORIGINS,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(uploadDir, { prefix: "/uploads/" });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Interview Platform API")
    .setDescription("Jobs, asynchronous interviews, candidate answers, and weighted reviews")
    .setVersion("0.1")
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
