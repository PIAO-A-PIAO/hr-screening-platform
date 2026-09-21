"use client";

import Link from "next/link";
import { useState } from "react";
import { updatePositionStatus, type PositionSummaryResponse, type WorkflowStatus } from "../lib/position-api";
import { Button, ButtonLink } from "./ui/button";
import { StatusBadge } from "./ui/status-badge";

const COUNTS: Array<{ status: WorkflowStatus; label: string }> = [
  { status: "INVITED", label: "Invited" }, { status: "TO_EVALUATE", label: "To evaluate" },
  { status: "PHASE_1", label: "Phase 1" }, { status: "PHASE_2", label: "Phase 2" },
  { status: "PHASE_3", label: "Phase 3" }, { status: "DISCARDED", label: "Discarded" },
];

export function PositionSummaryCard({ position, onTagClick, onChanged }: {
  position: PositionSummaryResponse; onTagClick: (tag: string) => void; onChanged: () => void;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function closePosition() {
    if (!window.confirm(`Close ${position.title}?`)) return;
    setUpdatingStatus(true); setError(null);
    try { await updatePositionStatus(position.id, "CLOSED"); onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not close position"); }
    finally { setUpdatingStatus(false); }
  }
  async function reopenPosition() {
    setUpdatingStatus(true); setError(null);
    try { await updatePositionStatus(position.id, "OPEN"); onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reopen position"); }
    finally { setUpdatingStatus(false); }
  }

  return (
    <article className="positionCard">
      <Link className="positionCardBody" href={`/positions/${encodeURIComponent(position.id)}`} aria-label={`Open ${position.title}`}>
        <div className="positionCardHeading"><h3>{position.title}</h3><StatusBadge status={position.status} /></div>
        <div className="positionDepartmentList"><strong className="positionMetaLabel">Department:</strong>{position.departments.length ? position.departments.map((department) => <span key={department.id}>{department.name}</span>) : <span>No department</span>}</div>
      </Link>

      <div className="positionTagList" aria-label="Position tags">
        <strong className="positionMetaLabel">Tags:</strong>
        {position.tags.length ? position.tags.map((tag) => <button key={tag} type="button" className="positionTag" onClick={() => onTagClick(tag)}>{tag}</button>) : <span className="positionNoTags">No tags</span>}
      </div>

      <div className="positionWorkflowCounts" aria-label="Candidate status counts">
        {COUNTS.map(({ status, label }) => (
          <Link key={status} className={status === "TO_EVALUATE" && position.workflowCounts[status] > 0 ? "workflowCount needsAttention" : "workflowCount"} href={`/positions/${encodeURIComponent(position.id)}?status=${status.toLowerCase().replace("_", "-")}`}>
            <span>{label}</span><strong>{position.workflowCounts[status]}</strong>
          </Link>
        ))}
      </div>

      <footer className="positionCardFooter">
        <span>{position.candidateCount} total candidates</span>
        <div className="positionCardActions">
          <ButtonLink href={`/positions/${encodeURIComponent(position.id)}/edit`} variant="secondary" size="small">Configure</ButtonLink>
          {position.status === "CLOSED"
            ? <Button variant="secondary" size="small" loading={updatingStatus} onClick={reopenPosition}>Reopen</Button>
            : <Button variant="ghost" size="small" loading={updatingStatus} onClick={closePosition}>Close</Button>}
        </div>
      </footer>
      {error && <p className="positionCardError" role="alert">{error}</p>}
    </article>
  );
}
