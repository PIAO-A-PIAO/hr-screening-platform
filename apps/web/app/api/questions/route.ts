import { NextRequest } from "next/server";

export const runtime = "nodejs";

function getBackendBaseUrl() {
  return (process.env.API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
}

async function proxy(request: NextRequest) {
  const backendUrl = `${getBackendBaseUrl()}/questions${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch {
    return Response.json(
      {
        statusCode: 503,
        error: "Service Unavailable",
        message: "Question API backend is not reachable",
      },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxy(request);
}

export async function POST(request: NextRequest) {
  return proxy(request);
}

export async function PUT(request: NextRequest) {
  return proxy(request);
}

export async function PATCH(request: NextRequest) {
  return proxy(request);
}

export async function DELETE(request: NextRequest) {
  return proxy(request);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
