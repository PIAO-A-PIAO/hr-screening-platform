import { NextRequest } from "next/server";
import { proxyRequest } from "../../../backend-proxy";

export const runtime = "nodejs";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params;
  return proxyRequest(request, `/positions/${encodeURIComponent(positionId)}/status`);
}
