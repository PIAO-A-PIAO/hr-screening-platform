import { NextRequest } from 'next/server';
import { proxyRequest } from '../../backend-proxy';
export const runtime = 'nodejs';
const forward = async (request: NextRequest, context: { params: Promise<{ path: string[] }> }) =>
  proxyRequest(request, `/admin/${(await context.params).path.map(encodeURIComponent).join('/')}`);
export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
