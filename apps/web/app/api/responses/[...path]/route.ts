import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

async function proxy(
  request: NextRequest,
  path: string[] | undefined,
) {
  const suffix =
    path
      ?.map((segment) => encodeURIComponent(segment))
      .join("/") ?? "";

  const backendPath = suffix
    ? `/responses/${suffix}`
    : "/responses";

  return proxyRequest(request, backendPath);
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      path?: string[];
    }>;
  },
) {
  const params = await context.params;
  return proxy(request, params.path);
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      path?: string[];
    }>;
  },
) {
  const params = await context.params;
  return proxy(request, params.path);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}