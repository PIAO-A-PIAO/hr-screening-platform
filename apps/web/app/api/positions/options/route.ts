import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return proxyRequest(request, "/positions/options");
}
