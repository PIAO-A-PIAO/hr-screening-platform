'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InternalUser } from '../../lib/internal-auth';

type Editor = { id?: string; name: string; email: string; role: 'ADMIN' | 'RECRUITER'; password: string; isActive: boolean; departmentIds: string[] };
const blank = (): Editor => ({ name: '', email: '', role: 'RECRUITER', password: '', isActive: true, departmentIds: [] });
const parseError = async (response: Response) => { const data = await response.json().catch(() => ({})) as { message?: string | string[] }; return Array.isArray(data.message) ? data.message.join(', ') : data.message ?? `Request failed (${response.status})`; };

export default function AdminPage() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const [userResponse, optionResponse] = await Promise.all([fetch('/api/admin/users', { cache: 'no-store' }), fetch('/api/positions/options', { cache: 'no-store' })]);
    if (!userResponse.ok || !optionResponse.ok) throw new Error('Could not load administration data');
    setUsers(await userResponse.json() as InternalUser[]);
    setDepartments((await optionResponse.json() as { departments: { id: string; name: string }[] }).departments);
  }, []);
  useEffect(() => { void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Could not load users')); }, [load]);
  const filtered = useMemo(() => users.filter(user => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editor) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const input = editor.id ? { name: editor.name, role: editor.role, isActive: editor.isActive, ...(editor.password ? { password: editor.password } : {}) } : { name: editor.name, email: editor.email, role: editor.role, password: editor.password, departmentIds: editor.role === 'RECRUITER' ? editor.departmentIds : [] };
      const response = await fetch(editor.id ? `/api/admin/users/${encodeURIComponent(editor.id)}` : '/api/admin/users', { method: editor.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(await parseError(response));
      const saved = await response.json() as InternalUser;
      if (editor.id && editor.role === 'RECRUITER') {
        const assigned = await fetch(`/api/admin/users/${encodeURIComponent(saved.id)}/departments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ departmentIds: editor.departmentIds }) });
        if (!assigned.ok) throw new Error(await parseError(assigned));
      }
      await load(); setEditor(null); setMessage('User saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save user'); }
    finally { setBusy(false); }
  }
  return <div className="adminWorkspace"><header className="pageHeader"><div><span className="sectionLabel">Access management</span><h1>Administration</h1><p>Manage internal accounts and recruiter department access.</p></div></header>
    <div className="adminMetrics"><div><strong>{users.filter(user => user.role === 'RECRUITER' && user.isActive).length}</strong><span>Active recruiters</span></div><div><strong>{departments.length}</strong><span>Departments</span></div><div><strong>{users.filter(user => user.role === 'ADMIN' && user.isActive).length}</strong><span>Active admins</span></div></div>
    <section className="adminPanel"><div className="adminToolbar"><h2>Internal users</h2><input type="search" placeholder="Search users" value={search} onChange={e => setSearch(e.target.value)} /><button type="button" className="primaryButton" onClick={() => { setEditor(blank()); setError(''); }}>Add internal user</button></div>
      {message && <p role="status">{message}</p>}{error && <p className="accessError" role="alert">{error}</p>}
      <div className="adminTableWrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Departments</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.departments.map(d => d.name).join(', ') || '—'}</td><td>{user.isActive ? 'Active' : 'Inactive'}</td><td><button type="button" onClick={() => { setEditor({ ...user, password: '', departmentIds: user.departments.map(d => d.id) }); setError(''); }}>Edit</button></td></tr>)}</tbody></table>{!filtered.length && <p>No matching users.</p>}</div></section>
    {editor && <div className="adminDialogBackdrop"><form className="adminDialog" onSubmit={event => void save(event)}><div className="adminDialogHeader"><h2>{editor.id ? 'Edit internal user' : 'Add internal user'}</h2><button type="button" onClick={() => setEditor(null)}>Close</button></div><label>Full name<input required value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></label><label>Work email<input type="email" required disabled={Boolean(editor.id)} value={editor.email} onChange={e => setEditor({ ...editor, email: e.target.value })} /></label><label>Role<select value={editor.role} onChange={e => setEditor({ ...editor, role: e.target.value as Editor['role'], departmentIds: e.target.value === 'ADMIN' ? [] : editor.departmentIds })}><option value="RECRUITER">Recruiter</option><option value="ADMIN">Admin</option></select></label>{editor.role === 'RECRUITER' && <fieldset><legend>Assigned departments</legend>{departments.map(department => <label className="adminCheck" key={department.id}><input type="checkbox" checked={editor.departmentIds.includes(department.id)} onChange={e => setEditor({ ...editor, departmentIds: e.target.checked ? [...editor.departmentIds, department.id] : editor.departmentIds.filter(id => id !== department.id) })} />{department.name}</label>)}{!departments.length && <p>Create departments from Positions first.</p>}</fieldset>}<label>{editor.id ? 'Reset password (optional)' : 'Password'}<input type="password" minLength={12} required={!editor.id} value={editor.password} onChange={e => setEditor({ ...editor, password: e.target.value })} autoComplete="new-password" /></label>{editor.id && <label className="adminCheck"><input type="checkbox" checked={editor.isActive} onChange={e => setEditor({ ...editor, isActive: e.target.checked })} />Active account</label>}{error && <p role="alert" className="accessError">{error}</p>}<button className="primaryButton" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button></form></div>}
  </div>;
}
