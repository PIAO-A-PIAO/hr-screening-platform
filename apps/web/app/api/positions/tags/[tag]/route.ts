import { NextRequest } from "next/server";
import { proxyRequest } from "../../../backend-proxy";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  return proxyRequest(request, `/positions/tags/${encodeURIComponent(tag)}`);
}
