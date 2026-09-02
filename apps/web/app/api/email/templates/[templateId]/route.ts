import { NextRequest } from "next/server";
import { proxyRequest } from "../../../backend-proxy";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return proxyRequest(request, `/email/templates/${encodeURIComponent(templateId)}`);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return proxyRequest(request, `/email/templates/${encodeURIComponent(templateId)}`);
}
