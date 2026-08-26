import { config as loadDotenv } from "dotenv";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

const repositoryRoot = resolve(__dirname, "../../../..");

loadDotenv({
  path: resolve(repositoryRoot, ".env"),
  override: false,
});

const environmentSchema = z.object({
  APP_ENV: z.enum(["local", "ci", "staging", "production"]).default("local"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.preprocess(
    (value) => value ?? "",
    z.string().min(1, "DATABASE_URL is required"),
  ),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
  WEB_ORIGIN: z.preprocess(
    (value) => value ?? "",
    z.string().min(1, "WEB_ORIGIN is required"),
  ),
    EMAIL_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),

  SMTP_HOST: z.string().optional(),

  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),

  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),

  SMTP_USER: z.string().optional(),

  SMTP_PASSWORD: z.string().optional(),

  EMAIL_FROM: z.string().optional(),
  STORAGE_DRIVER: z.enum(["filesystem", "s3"]).default("filesystem"),
  STORAGE_DIR: z.preprocess(
    (value) => value ?? "",
    z.string().min(1, "STORAGE_DIR is required"),
  ),
  AWS_REGION: z.string().min(1).optional(),
  S3_BUCKET_NAME: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["error", "warn", "log", "debug", "verbose"]).default("log"),
}).superRefine((environment, context) => {
  if (environment.STORAGE_DRIVER !== "s3") return;

  if (!environment.AWS_REGION) {
    context.addIssue({
      code: "custom",
      path: ["AWS_REGION"],
      message: "AWS_REGION is required when STORAGE_DRIVER is s3",
    });
  }

  if (!environment.S3_BUCKET_NAME) {
    context.addIssue({
      code: "custom",
      path: ["S3_BUCKET_NAME"],
      message: "S3_BUCKET_NAME is required when STORAGE_DRIVER is s3",
    });
  }
});

type ParsedEnvironment = z.infer<typeof environmentSchema>;

export type AppEnvironment = ParsedEnvironment & {
  WEB_ORIGINS: string[];
};

let cachedEnvironment: AppEnvironment | undefined;

export function parseEnvironment(source: NodeJS.ProcessEnv): AppEnvironment {
  const parsed = environmentSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Configuration error: ${details}`);
  }

  const webOrigins = parsed.data.WEB_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of webOrigins) {
    try {
      new URL(origin);
    } catch {
      throw new Error(
        `Configuration error: WEB_ORIGIN contains an invalid URL: ${origin}`,
      );
    }
  }

  return {
    ...parsed.data,
    WEB_ORIGINS: webOrigins,
  };
}

export function getEnvironment(): AppEnvironment {
  cachedEnvironment ??= parseEnvironment(process.env);
  return cachedEnvironment;
}

export function resolveFromRepository(path: string) {
  return isAbsolute(path) ? path : resolve(repositoryRoot, path);
}