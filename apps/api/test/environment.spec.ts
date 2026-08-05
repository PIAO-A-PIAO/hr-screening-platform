import { parseEnvironment } from "../src/config/environment";

const validEnvironment = {
  APP_ENV: "ci",
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://interview:interview@localhost:5432/interview",
  API_PORT: "4100",
  WEB_ORIGIN: "http://localhost:3000,https://staging.example.com",
  UPLOAD_DIR: "./var/uploads",
  DEMO_USER_EMAIL: "recruiter@demo.local",
  LOG_LEVEL: "warn",
};

describe("parseEnvironment", () => {
  it("parses ports and comma-separated web origins", () => {
    const result = parseEnvironment(validEnvironment);
    expect(result.API_PORT).toBe(4100);
    expect(result.WEB_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://staging.example.com",
    ]);
  });

  it("names missing required configuration", () => {
    expect(() => parseEnvironment({ ...validEnvironment, DATABASE_URL: "" }))
      .toThrow("DATABASE_URL is required");
  });

  it("rejects invalid origins before the server starts", () => {
    expect(() => parseEnvironment({ ...validEnvironment, WEB_ORIGIN: "not-a-url" }))
      .toThrow("WEB_ORIGIN contains an invalid URL");
  });
});
