import "reflect-metadata";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadDir = resolve(process.env.UPLOAD_DIR ?? "./var/uploads");
  mkdirSync(uploadDir, { recursive: true });

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(uploadDir, { prefix: "/uploads/" });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Interview Platform API")
    .setDescription("Jobs, asynchronous interviews, candidate answers, and weighted reviews")
    .setVersion("0.1")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(Number(process.env.API_PORT ?? 4000));
}

void bootstrap();
