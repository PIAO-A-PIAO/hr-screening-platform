'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { currentUser, safeReturn } from '../../lib/internal-auth';
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void currentUser().then(user => { if (user) router.replace(safeReturn(new URLSearchParams(window.location.search).get('returnTo'))); }); }, [router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('Invalid email or password');
      router.replace(safeReturn(new URLSearchParams(window.location.search).get('returnTo'))); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sign in failed'); }
    finally { setBusy(false); }
  }
  return <main className="accessShell"><form className="accessCard" onSubmit={submit}><span className="sectionLabel">Digital Shovel</span><h1>Sign in to DS-HR</h1><label>Work email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p role="alert" className="accessError">{error}</p>}<button className="primaryButton" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><p>First setup? <Link href="/register">Create the initial admin</Link></p></form></main>;
}
