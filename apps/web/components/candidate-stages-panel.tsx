'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Candidate = {
  id: string; stage: string; stageRevision: number; inviteToken: string | null;
  invitedAt: string; allowedTransitions: string[];
  user: { id: string; name: string; email: string };
  attempt: { id: string; status: string; submittedAt: string | null; scoreSum: number | null } | null;
};
type Board = { stages: string[]; counts: Record<string, number>; candidates: Candidate[]; reviewer: { id: string; name: string } };
type Change = { id: string; fromStage: string; toStage: string; actorName: string; changedAt: string };
const label = (value: string) => value.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');

async function request<T>(url: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(url, {
    method: method ?? (body ? 'PATCH' : 'GET'), cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(', ') : payload.message ?? 'Request failed');
  return payload as T;
}

export function CandidateStagesPanel({ positionId, updatedAt, candidateCount, onChanged }: {
  positionId: string; updatedAt: string; candidateCount: number; onChanged: () => void;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [active, setActive] = useState('ALL');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Record<string, Change[]>>({});
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const generation = useRef(0);
  const base = `/api/positions/${encodeURIComponent(positionId)}/candidates`;
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const next = await request<Board>(base);
    if (current === generation.current) setBoard(next);
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    const load = () => { void refresh().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Refresh failed');
    }); };
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; generation.current += 1; window.removeEventListener('focus', load); };
  }, [refresh, updatedAt, candidateCount]);
  async function change(candidate: Candidate, stage: string) {
    if (!stage) return;
    if (['HIRED', 'DISCARDED', 'WITHDRAWN'].includes(stage) && !window.confirm(`Move ${candidate.user.name} to ${label(stage)}? This ends this application's pipeline and cancels pending reminders.`)) return;
    setBusy(true); setError('');
    try {
      await request(`${base}/${encodeURIComponent(candidate.id)}/stage`, {
        stage, expectedStage: candidate.stage, expectedRevision: candidate.stageRevision,
      });
      setHistory({}); setHistoryOpen(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stage update failed');
      await refresh().catch(() => undefined);
    } finally { setBusy(false); }
  }
  async function showHistory(id: string) {
    if (historyOpen === id) { setHistoryOpen(null); return; }
    setBusy(true); setError('');
    try {
      const items = await request<Change[]>(`${base}/${encodeURIComponent(id)}/history`);
      setHistory((current) => ({ ...current, [id]: items })); setHistoryOpen(id);
    } catch (e) { setError(e instanceof Error ? e.message : 'History failed'); }
    finally { setBusy(false); }
  }
  return <div className="detailCard" style={{ display: 'grid', gap: 16 }}>
    <div><h3>Candidate stages</h3><p>Track each candidate independently for this position.</p></div>
    {error && <div role="alert" className="stateCard errorState">{error}</div>}
    <>
      <div className="pillRow">
        <span>Reviewer: {board?.reviewer.name}</span>
        <button type="button" className="secondaryButton" disabled={busy} onClick={() => {
          setBusy(true); setError('');
          void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Refresh failed')).finally(() => setBusy(false));
        }}>Refresh</button>
      </div>
      {board && <>
        <div role="group" aria-label="Filter by candidate stage" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['ALL', ...board.stages].map((stage) => <button key={stage} type="button"
            className={active === stage ? 'primaryButton' : 'secondaryButton'} aria-pressed={active === stage}
            onClick={() => setActive(stage)}>
            {stage === 'ALL' ? 'All' : label(stage)} ({stage === 'ALL' ? board.candidates.length : board.counts[stage]})
          </button>)}
        </div>
        {board.candidates.filter((c) => active === 'ALL' || c.stage === active).length === 0 && <p>No candidates in this stage.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
          {board.candidates.filter((c) => active === 'ALL' || c.stage === active).map((candidate) => <article key={candidate.id} className="detailCard" style={{ display: 'grid', gap: 10, alignContent: 'start', overflowWrap: 'anywhere' }}>
            <strong>{candidate.user.name}</strong><span>{candidate.user.email}</span>
            <span className="pill">{label(candidate.stage)}</span>
            <small>Invited {new Date(candidate.invitedAt).toLocaleString()}</small>
            {candidate.attempt && <small>Attempt: {label(candidate.attempt.status)}{candidate.attempt.scoreSum !== null ? ` · Score: ${candidate.attempt.scoreSum}` : ''}</small>}
            {candidate.attempt?.submittedAt && <small>Submitted {new Date(candidate.attempt.submittedAt).toLocaleString()}</small>}
            {candidate.attempt && candidate.inviteToken && <Link href={`/attempts/view?attemptId=${encodeURIComponent(candidate.attempt.id)}&inviteToken=${encodeURIComponent(candidate.inviteToken)}`}>View attempt</Link>}
            {candidate.allowedTransitions.length > 0 ? <label style={{ display: 'grid', gap: 6 }}>Move to
              <select aria-label={`Change stage for ${candidate.user.name}`} value="" disabled={busy}
                onChange={(event) => void change(candidate, event.target.value)}>
                <option value="">Choose stage</option>
                {candidate.allowedTransitions.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
              </select>
            </label> : <small>No further transitions available.</small>}
            <button type="button" className="secondaryButton" disabled={busy} onClick={() => {
              if (!window.confirm(`Delete ${candidate.user.name}'s assignment and attempt for this position?`)) return;
              setBusy(true); setError('');
              void request(`${base}/${encodeURIComponent(candidate.id)}`, undefined, 'DELETE')
                .then(() => refresh()).then(onChanged)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Delete failed'))
                .finally(() => setBusy(false));
            }}>Delete assignment</button>
            <button type="button" className="secondaryButton" disabled={busy} onClick={() => void showHistory(candidate.id)} aria-expanded={historyOpen === candidate.id}>Stage history</button>
            {historyOpen === candidate.id && <div>
              {history[candidate.id]?.length === 0 ? <small>No reviewer changes yet. Invitation and attempt progress are tracked automatically.</small> : <ul>
                {history[candidate.id]?.map((item) => <li key={item.id}>{label(item.fromStage)} → {label(item.toStage)}<br /><small>{item.actorName} · {new Date(item.changedAt).toLocaleString()}</small></li>)}
              </ul>}
            </div>}
          </article>)}
        </div>
      </>}
    </>
  </div>;
}
