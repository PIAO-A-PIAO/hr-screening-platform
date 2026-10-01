import { NextRequest } from "next/server";
import { proxyRequest } from "../../../backend-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return proxyRequest(request, "/email/templates/settings");
}

export function PATCH(request: NextRequest) {
  return proxyRequest(request, "/email/templates/settings");
}
