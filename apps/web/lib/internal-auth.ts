export type InternalUser = { id: string; name: string; email: string; role: 'ADMIN' | 'RECRUITER'; isActive: boolean; departments: { id: string; name: string }[] };
export async function currentUser(): Promise<InternalUser | null> {
  let response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (response.status === 401) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
    if (refreshed.ok) response = await fetch('/api/auth/me', { cache: 'no-store' });
  }
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not verify your session');
  return response.json() as Promise<InternalUser>;
}
export function safeReturn(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') && !value.startsWith('/login') && !value.startsWith('/register') ? value : '/';
}
