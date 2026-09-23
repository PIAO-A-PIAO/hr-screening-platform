import { NextRequest } from "next/server";
import { proxyRequest } from "../../../backend-proxy";

export const runtime = "nodejs";

async function proxy(request: NextRequest, context: { params: Promise<{ testId: string }> }) {
  const { testId } = await context.params;
  return proxyRequest(request, `/tests/${encodeURIComponent(testId)}/closing-video`);
}

export function GET(request: NextRequest, context: { params: Promise<{ testId: string }> }) { return proxy(request, context); }
export function POST(request: NextRequest, context: { params: Promise<{ testId: string }> }) { return proxy(request, context); }
export function DELETE(request: NextRequest, context: { params: Promise<{ testId: string }> }) { return proxy(request, context); }
