import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

async function proxy(request: NextRequest, positionId: string) {
  return proxyRequest(request, `/positions/${encodeURIComponent(positionId)}`);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const resolved = await params;
  return proxy(request, resolved.positionId);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const resolved = await params;
  return proxy(request, resolved.positionId);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const resolved = await params;
  return proxy(request, resolved.positionId);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const resolved = await params;
  return proxy(request, resolved.positionId);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
