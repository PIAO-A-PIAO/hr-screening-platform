import { parseEnvironment } from "../src/config/environment";

const validEnvironment = {
  APP_ENV: "local",
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@localhost:5432/database",
  API_PORT: "4000",
  WEB_ORIGIN: "http://localhost:3000",
  STORAGE_DRIVER: "filesystem",
  STORAGE_DIR: "var/private-storage",
  LOG_LEVEL: "warn",
};

describe("environment configuration", () => {
  it("parses a valid environment", () => {
    const result = parseEnvironment(validEnvironment);

    expect(result.API_PORT).toBe(4000);
    expect(result.WEB_ORIGINS).toEqual(["http://localhost:3000"]);
    expect(result.STORAGE_DRIVER).toBe("filesystem");
  });

  it("names a missing database variable", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        DATABASE_URL: undefined,
      }),
    ).toThrow("DATABASE_URL");
  });

  it("rejects an invalid web origin", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        WEB_ORIGIN: "not-a-url",
      }),
    ).toThrow("invalid URL");
  });

  it("requires AWS settings for S3 storage", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        STORAGE_DRIVER: "s3",
      }),
    ).toThrow("AWS_REGION");
  });

  it("parses valid S3 storage settings", () => {
    const result = parseEnvironment({
      ...validEnvironment,
      STORAGE_DRIVER: "s3",
      AWS_REGION: "ca-central-1",
      S3_BUCKET_NAME: "ds-hr-staging-assets-2026",
    });

    expect(result.STORAGE_DRIVER).toBe("s3");
    expect(result.S3_BUCKET_NAME).toBe("ds-hr-staging-assets-2026");
  });
});