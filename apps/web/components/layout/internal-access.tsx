'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { currentUser, type InternalUser } from '../../lib/internal-auth';
import { RecruiterShell } from './recruiter-shell';

export function InternalAccess({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  const pathname = usePathname(); const router = useRouter();
  const [user, setUser] = useState<InternalUser | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    currentUser().then(value => {
      if (!active) return;
      if (!value) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      else if (pathname.startsWith('/admin') && value.role !== 'ADMIN') router.replace('/');
      else setUser(value);
    }).catch(() => { if (active) setError('Could not verify your session. Try refreshing.'); });
    const timer = setInterval(() => { void fetch('/api/auth/refresh', { method: 'POST' }).then(response => { if (response.status === 401) router.replace('/login'); }); }, 10 * 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [pathname, router]);
  if (error) return <main className="accessShell"><p role="alert">{error}</p></main>;
  if (!user) return <main className="accessShell" role="status">Checking access…</main>;
  return <RecruiterShell user={user} title={title} eyebrow={eyebrow}>{children}</RecruiterShell>;
}
