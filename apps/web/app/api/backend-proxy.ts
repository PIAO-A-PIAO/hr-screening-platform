import { NextRequest } from "next/server";

function unique(values: string[]) {
  return [...new Set(values)];
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function getBackendBaseUrls() {
  const configured = process.env.API_URL?.trim();
  const publicConfigured = process.env.NEXT_PUBLIC_API_URL?.trim();

  return unique(
    [configured, publicConfigured, "http://api:4000/api", "http://127.0.0.1:4000/api", "http://localhost:4000/api"]
      .filter((value): value is string => Boolean(value))
      .map(trimTrailingSlash),
  );
}

export async function proxyRequest(request: NextRequest, backendPath: string) {
  const method = request.method;
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const urls = getBackendBaseUrls().map((baseUrl) => `${baseUrl}${backendPath}${request.nextUrl.search}`);

  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        cache: "no-store",
      });

      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    } catch (error) {
      lastError = error;
    }
  }

  return Response.json(
    {
      statusCode: 503,
      error: "Service Unavailable",
      message: "API backend is not reachable from the web server",
      attempts: urls,
      cause: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown"),
    },
    { status: 503 },
  );
}
