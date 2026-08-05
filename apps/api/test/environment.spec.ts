import { parseEnvironment } from "../src/config/environment";

const validEnvironment = {
  APP_ENV: "local",
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@localhost:5432/database",
  API_PORT: "4000",
  WEB_ORIGIN: "http://localhost:3000",
  STORAGE_DIR: "var/private-storage",
  LOG_LEVEL: "warn",
};

describe("environment configuration", () => {
  it("parses a valid environment", () => {
    const result = parseEnvironment(validEnvironment);
    expect(result.API_PORT).toBe(4000);
    expect(result.WEB_ORIGINS).toEqual(["http://localhost:3000"]);
  });

  it("names a missing database variable", () => {
    expect(() => parseEnvironment({ ...validEnvironment, DATABASE_URL: undefined }))
      .toThrow("DATABASE_URL");
  });

  it("rejects an invalid web origin", () => {
    expect(() => parseEnvironment({ ...validEnvironment, WEB_ORIGIN: "not-a-url" }))
      .toThrow("invalid URL");
  });
});
