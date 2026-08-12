import { NextRequest } from "next/server";
import { proxyRequest } from "../../../../backend-proxy";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ testId: string }>;
  },
) {
  const { testId } = await context.params;

  return proxyRequest(
    request,
    `/tests/${encodeURIComponent(testId)}/questions/order`,
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}