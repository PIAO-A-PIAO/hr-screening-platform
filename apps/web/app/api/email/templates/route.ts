import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

async function proxy(request: NextRequest) {
  return proxyRequest(request, "/email/templates");
}

export async function GET(request: NextRequest) {
  return proxy(request);
}

export async function POST(request: NextRequest) {
  return proxy(request);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
