"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";
import { Tabs } from "./ui/tabs";

const STATUSES = ["INVITED", "TO_EVALUATE", "PHASE_1", "PHASE_2", "PHASE_3", "DISCARDED"] as const;
type WorkflowStatus = typeof STATUSES[number];
type PipelineSort = "INVITED_DESC" | "INVITED_ASC" | "NAME_ASC";
type EmailHistoryItem = { id: string; type: string; templateName: string; subject: string; sentAt: string; sequenceStepOrder: number };
type Interview = {
  id: string; workflowStatus: WorkflowStatus; workflowRevision: number; inviteToken: string | null;
  invitedAt: string; allowedTransitions: WorkflowStatus[];
  candidate: { id: string; name: string; email: string };
  attempt: { id: string; status: string; submittedAt: string | null; scoreSum: number | null } | null;
  emailHistory: EmailHistoryItem[];
};
type Pipeline = {
  activeStatus: WorkflowStatus; counts: Record<WorkflowStatus, number>; interviews: Interview[];
  reviewer: { id: string; name: string };
};
type Change = { id: string; fromStage: string; toStage: string; actorName: string; changedAt: string };

const label = (value: string) => value.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const slug = (status: WorkflowStatus) => status.toLowerCase().replaceAll("_", "-");

async function request<T>(url: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(url, { method: method ?? (body ? "PATCH" : "GET"), cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json();
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(", ") : payload.message ?? "Request failed");
  return payload as T;
}

export function CandidateStagesPanel({ positionId, initialStatus, updatedAt, candidateCount, onChanged }: {
  positionId: string; initialStatus: WorkflowStatus; updatedAt: string; candidateCount: number; onChanged: () => void;
}) {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [active, setActive] = useState<WorkflowStatus>(initialStatus);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PipelineSort>("INVITED_DESC");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Record<string, Change[]>>({});
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState<string | null>(null);
  const generation = useRef(0);
  const base = `/api/positions/${encodeURIComponent(positionId)}/candidates`;

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setActive(initialStatus);
  }, [initialStatus]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const query = new URLSearchParams({ status: active, sort });
    if (search) query.set("search", search);
    const next = await request<Pipeline>(`${base}?${query.toString()}`);
    if (current === generation.current) setPipeline(next);
  }, [active, base, search, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void refresh().catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Pipeline could not be loaded"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; generation.current += 1; };
  }, [refresh, updatedAt, candidateCount]);

  function changeTab(status: WorkflowStatus) {
    setActive(status); setSearchInput(""); setSearch(""); setHistoryOpen(null); setEmailOpen(null);
    router.replace(`/positions/${encodeURIComponent(positionId)}?status=${slug(status)}`, { scroll: false });
  }

  async function change(interview: Interview, status: WorkflowStatus) {
    if (status === "DISCARDED" && !window.confirm(`Move ${interview.candidate.name} to Discarded and cancel pending reminders?`)) return;
    setBusyId(interview.id); setError("");
    try {
      await request(`${base}/${encodeURIComponent(interview.id)}/status`, { stage: status, expectedStage: interview.workflowStatus, expectedRevision: interview.workflowRevision });
      setHistory({}); setHistoryOpen(null); setEmailOpen(null); await refresh(); onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status update failed"); await refresh().catch(() => undefined);
    } finally { setBusyId(null); }
  }

  async function showHistory(interviewId: string) {
    if (historyOpen === interviewId) { setHistoryOpen(null); return; }
    if (!history[interviewId]) {
      setBusyId(interviewId); setError("");
      try { const items = await request<Change[]>(`${base}/${encodeURIComponent(interviewId)}/history`); setHistory((current) => ({ ...current, [interviewId]: items })); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "History could not be loaded"); }
      finally { setBusyId(null); }
    }
    setHistoryOpen(interviewId); setEmailOpen(null);
  }

  async function remove(interview: Interview) {
    if (!window.confirm(`Remove ${interview.candidate.name} from this position? Their interview and attempt data will be deleted.`)) return;
    setBusyId(interview.id); setError("");
    try { await request(`${base}/${encodeURIComponent(interview.id)}`, undefined, "DELETE"); await refresh(); onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Interview could not be removed"); }
    finally { setBusyId(null); }
  }

  const tabItems = STATUSES.map((status) => ({ id: status, label: label(status), count: pipeline?.counts[status] ?? 0 }));
  return (
    <section className="candidatePipeline" aria-labelledby="candidate-pipeline-title">
      <header className="candidatePipelineHeader">
        <div><span className="positionsKicker">Candidate pipeline</span><h2 id="candidate-pipeline-title">Applications</h2></div>
        <span className="candidateReviewer">Reviewer: {pipeline?.reviewer.name ?? "Temporary reviewer"}</span>
      </header>
      <div className="candidatePipelineTabs"><Tabs label="Candidate workflow status" items={tabItems} activeId={active} onChange={(id) => changeTab(id as WorkflowStatus)} /></div>
      <div className="candidatePipelineToolbar">
        <label><span>Search candidate name</span><input type="search" value={searchInput} placeholder="Candidate name" onChange={(event) => setSearchInput(event.target.value)} /></label>
        <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as PipelineSort)}><option value="INVITED_DESC">Newest invitation</option><option value="INVITED_ASC">Oldest invitation</option><option value="NAME_ASC">Candidate name A–Z</option></select></label>
        <Button variant="secondary" loading={loading} onClick={() => void refresh()}>Refresh</Button>
      </div>
      {error && <FeedbackState kind="error" title="Candidate pipeline could not be updated" description={error} />}
      {loading && !pipeline && <FeedbackState kind="loading" title="Loading candidates" description="Retrieving interviews for this workflow status." />}
      {!loading && pipeline?.interviews.length === 0 && <FeedbackState kind="empty" title={`No ${label(active).toLowerCase()} candidates`} description={search ? "No candidate names match the current search." : "Candidates in this workflow status will appear here."} />}
      {pipeline && pipeline.interviews.length > 0 && <div className="applicationList">
        {pipeline.interviews.map((interview) => {
          const reviewHref = `/positions/${encodeURIComponent(positionId)}/interview/${encodeURIComponent(interview.id)}?status=${slug(active)}`;
          return <article className="applicationCard" key={interview.id}>
            {active === "INVITED" ? <div className="applicationCardBody applicationCardBodyStatic"><ApplicationIdentity interview={interview} /></div> : <Link className="applicationCardBody" href={reviewHref}><ApplicationIdentity interview={interview} /></Link>}
            <div className="applicationCardStatus">
              <select className={`workflowPill workflowStatusSelect workflowPill-${slug(interview.workflowStatus)}`} aria-label={`Change status for ${interview.candidate.name}`} value={interview.workflowStatus} disabled={busyId === interview.id} onChange={(event) => void change(interview, event.target.value as WorkflowStatus)}><option value={interview.workflowStatus}>{label(interview.workflowStatus)}</option>{interview.allowedTransitions.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
              {interview.attempt && <small>{label(interview.attempt.status)}</small>}
            </div>
            <div className="applicationCardActions">
              <Button variant="ghost" size="small" disabled={busyId === interview.id} onClick={() => { setEmailOpen(emailOpen === interview.id ? null : interview.id); setHistoryOpen(null); }}>Email history ({interview.emailHistory.length})</Button>
              <Button variant="ghost" size="small" disabled={busyId === interview.id} onClick={() => void showHistory(interview.id)}>Status history</Button>
              <Button variant="danger" size="small" loading={busyId === interview.id} onClick={() => void remove(interview)}>Remove</Button>
            </div>
            {emailOpen === interview.id && <div className="applicationCardHistory"><strong>Email history</strong>{interview.emailHistory.length === 0 ? <small>No emails have been sent for this interview.</small> : <ul>{interview.emailHistory.map((email) => <li key={email.id}><span>{email.templateName}</span><small>{email.subject} · {new Date(email.sentAt).toLocaleString()}</small></li>)}</ul>}</div>}
            {historyOpen === interview.id && <div className="applicationCardHistory"><strong>Status history</strong>{history[interview.id]?.length === 0 ? <small>No reviewer status changes yet.</small> : <ul>{history[interview.id]?.map((item) => <li key={item.id}><span>{label(item.fromStage)} → {label(item.toStage)}</span><small>{item.actorName} · {new Date(item.changedAt).toLocaleString()}</small></li>)}</ul>}</div>}
          </article>;
        })}
      </div>}
    </section>
  );
}

function ApplicationIdentity({ interview }: { interview: Interview }) {
  return <><div className="applicationIdentity"><strong>{interview.candidate.name}</strong><span>{interview.candidate.email}</span></div><div className="applicationTiming"><span>Invited</span><strong>{new Date(interview.invitedAt).toLocaleString()}</strong>{interview.attempt?.submittedAt && <small>Submitted {new Date(interview.attempt.submittedAt).toLocaleString()}</small>}</div></>;
}
