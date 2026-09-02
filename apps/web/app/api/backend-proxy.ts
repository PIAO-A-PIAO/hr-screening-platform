import { NextRequest } from "next/server";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function getBackendBaseUrl() {
  const configured = process.env.API_URL?.trim();
  if (!configured) {
    throw new Error("API_URL is not configured");
  }

  return trimTrailingSlash(configured);
}

export async function proxyRequest(request: NextRequest, backendPath: string) {
  const method = request.method;
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}${backendPath}${request.nextUrl.search}`;

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
    return Response.json(
      {
        statusCode: 503,
        error: "Service Unavailable",
        message: "API backend is not reachable from the web server",
        attempts: [url],
        cause: error instanceof Error ? error.message : String(error ?? "unknown"),
      },
      { status: 503 },
    );
  }
}
