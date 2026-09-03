import { NextRequest } from "next/server";
import { proxyRequest } from "../../../../backend-proxy";

export const runtime = "nodejs";

async function proxy(request: NextRequest, positionId: string, assignmentId: string) {
  return proxyRequest(
    request,
    `/positions/${encodeURIComponent(positionId)}/assignments/${encodeURIComponent(assignmentId)}`,
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ positionId: string; assignmentId: string }> },
) {
  const resolved = await params;
  return proxy(request, resolved.positionId, resolved.assignmentId);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
