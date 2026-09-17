import { NextRequest } from "next/server";
import { proxyRequest } from "../../../../backend-proxy";

export const runtime = "nodejs";
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ positionId: string; interviewId: string }> }) {
  const { positionId, interviewId } = await params;
  return proxyRequest(request, `/positions/${encodeURIComponent(positionId)}/interviews/${encodeURIComponent(interviewId)}`);
}
