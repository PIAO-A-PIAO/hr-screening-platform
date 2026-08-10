import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyRequest(request, "/health/ready");
}
