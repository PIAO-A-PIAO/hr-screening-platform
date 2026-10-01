'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { currentUser } from '../../lib/internal-auth';
export default function RegisterPage() {
  const router = useRouter(); const [open, setOpen] = useState<boolean | null>(null);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void currentUser().then(user => { if (user) router.replace('/'); }); void fetch('/api/auth/bootstrap').then(r => r.json()).then((data: { open: boolean }) => setOpen(data.open)).catch(() => setError('Setup status unavailable')); }, [router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      if (!response.ok) { const data = await response.json() as { message?: string }; throw new Error(data.message ?? 'Registration failed'); }
      router.replace('/admin'); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Registration failed'); }
    finally { setBusy(false); }
  }
  return <main className="accessShell"><div className="accessCard"><span className="sectionLabel">Digital Shovel</span><h1>Set up DS-HR</h1>{open === null ? <p>Checking setup…</p> : !open ? <p>Registration is closed. Ask an administrator to create your account.</p> : <form onSubmit={submit}><label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label><label>Work email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label><label>Confirm password<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></label><button className="primaryButton" disabled={busy}>{busy ? 'Creating…' : 'Create admin account'}</button></form>}{error && <p className="accessError" role="alert">{error}</p>}<p><Link href="/login">Already have an account? Sign in</Link></p></div></main>;
}
