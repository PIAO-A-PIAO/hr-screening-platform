import { NextRequest } from "next/server";
import { proxyRequest } from "../../backend-proxy";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return proxyRequest(request, "/positions/departments");
}
