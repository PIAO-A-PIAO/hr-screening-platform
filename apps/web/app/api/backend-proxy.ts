import { NextRequest } from "next/server";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function getBackendBaseUrls() {
  const configured = process.env.API_URL?.trim()
    || process.env.NEXT_PUBLIC_API_URL?.trim()
    || "http://127.0.0.1:4000/api";
  const candidates = [configured];

  try {
    const url = new URL(configured);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
      candidates.push(url.toString());
    }
  } catch {
    // Keep the configured value even if it is not a fully qualified URL.
  }

  return [...new Set(candidates.map(trimTrailingSlash))];
}

export async function proxyRequest(request: NextRequest, backendPath: string) {
  const method = request.method;
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const attempts: string[] = [];
  let lastError: unknown;

  for (const baseUrl of getBackendBaseUrls()) {
    const url = `${baseUrl}${backendPath}${request.nextUrl.search}`;
    attempts.push(url);

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
      attempts,
      cause: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown"),
    },
    { status: 503 },
  );
}
