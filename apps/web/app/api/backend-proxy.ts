import { NextRequest } from "next/server";
import { getApiBaseUrlCandidates } from "../../lib/api-base-url";

export async function proxyRequest(request: NextRequest, backendPath: string) {
  const method = request.method;
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const attempts = getApiBaseUrlCandidates().map(
    (baseUrl) => `${baseUrl}${backendPath}${request.nextUrl.search}`,
  );

  for (const url of attempts) {
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
      if (url !== attempts.at(-1)) {
        continue;
      }

      return Response.json(
        {
          statusCode: 503,
          error: "Service Unavailable",
          message: "API backend is not reachable from the web server",
          attempts,
          cause: error instanceof Error ? error.message : String(error ?? "unknown"),
        },
        { status: 503 },
      );
    }
  }
}
