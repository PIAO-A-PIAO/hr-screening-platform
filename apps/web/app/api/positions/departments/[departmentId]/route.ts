import { NextRequest } from "next/server";
import { proxyRequest } from "../../../backend-proxy";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  return proxyRequest(request, `/positions/departments/${encodeURIComponent(departmentId)}`);
}
