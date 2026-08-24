import { NextRequest } from "next/server";
import { proxyRequest } from "../backend-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return proxyRequest(request, "/responses");
}

export function POST(request: NextRequest) {
  return proxyRequest(request, "/responses");
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}