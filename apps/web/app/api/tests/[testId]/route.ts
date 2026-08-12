import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

async function proxy(request: NextRequest, testId: string) {
  return proxyRequest(request, `/tests/${encodeURIComponent(testId)}`);
}

export async function GET(request: NextRequest, context: { params: Promise<{ testId: string }> }) {
  return proxy(request, (await context.params).testId);
}

export async function POST(request: NextRequest, context: { params: Promise<{ testId: string }> }) {
  return proxy(request, (await context.params).testId);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ testId: string }> }) {
  return proxy(request, (await context.params).testId);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ testId: string }> }) {
  return proxy(request, (await context.params).testId);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ testId: string }> }) {
  return proxy(request, (await context.params).testId);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
