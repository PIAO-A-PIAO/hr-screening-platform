function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getApiBaseUrlCandidates() {
  const candidates = [
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    "http://localhost:4000/api",
    "http://127.0.0.1:4000/api",
    "http://api:4000/api",
  ].filter(isNonEmptyString);

  return [...new Set(candidates.map((value) => trimTrailingSlash(value.trim())))];
}
