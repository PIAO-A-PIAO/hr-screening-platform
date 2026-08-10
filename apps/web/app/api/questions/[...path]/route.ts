import { NextRequest } from "next/server";

export const runtime = "nodejs";

function getBackendBaseUrl() {
  return (process.env.API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
}

function toQuestionPath(pathSegments: string[] | undefined) {
  if (!pathSegments || pathSegments.length === 0) return "";
  return `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
  const backendUrl = `${getBackendBaseUrl()}/questions${toQuestionPath(pathSegments)}${request.nextUrl.search}`;
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

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, (await context.params).path);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
