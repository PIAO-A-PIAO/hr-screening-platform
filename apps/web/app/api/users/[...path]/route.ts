import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
  const userPath = !pathSegments || pathSegments.length === 0
    ? "/users"
    : `/users/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;

  return proxyRequest(request, userPath);
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
