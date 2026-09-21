import { NextRequest } from 'next/server';
import { proxyRequest } from '../../../../backend-proxy';

export const runtime = 'nodejs';
async function handle(request: NextRequest,
  { params }: { params: Promise<{ positionId: string; path?: string[] }> }) {
  const { positionId, path = [] } = await params;
  const suffix = path.length ? '/' + path.map(encodeURIComponent).join('/') : '';
  return proxyRequest(request, `/positions/${encodeURIComponent(positionId)}/candidates${suffix}`);
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
