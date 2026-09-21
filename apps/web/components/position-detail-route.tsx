"use client";

import { useEffect, useState } from "react";
import { getPosition, type PositionResponse } from "../lib/position-api";
import { CandidateStagesPanel } from "./candidate-stages-panel";
import { InviteCandidateModal } from "./invite-candidate-modal";
import { AppIcon } from "./ui/app-icon";
import { Button, ButtonLink } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";

type WorkflowStatus = "INVITED" | "TO_EVALUATE" | "SHORTLISTED" | "DISCARDED";

export function PositionDetailRoute({ positionId, initialStatus }: { positionId: string; initialStatus: WorkflowStatus }) {
  const [position, setPosition] = useState<PositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function refreshPosition() {
    setError(null);
    try { setPosition(await getPosition(positionId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to refresh position"); }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    void getPosition(positionId).then((loaded) => { if (!cancelled) setPosition(loaded); }).catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to load position"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [positionId]);

  if (loading) return <FeedbackState kind="loading" title="Loading position" description="Preparing the candidate pipeline." />;
  if (error && !position) return <FeedbackState kind="error" title="Position could not be loaded" description={error} />;
  if (!position) return <FeedbackState kind="empty" title="Position not found" description="Return to the position directory and select another position." />;

  return <div className="positionPipelinePage">
    <header className="positionPipelineHero">
      <div>
        <ButtonLink href="/positions" variant="ghost" size="small" leadingIcon={<AppIcon name="arrow" size={16} />}>Back to positions</ButtonLink>
        <span className="sectionLabel">Position pipeline</span>
        <h1>{position.title}</h1>
      </div>
      <div className="positionPipelineHeaderActions"><Button onClick={() => setInviteOpen(true)}>Invite new candidate</Button><ButtonLink href={`/positions/${encodeURIComponent(position.id)}/edit`} variant="secondary">Configure position</ButtonLink></div>
    </header>

    {error && <FeedbackState kind="error" title="Position could not be refreshed" description={error} />}
    <div className="pillRow positionPipelineMeta">
      {position.departments.map((department) => <span className="pill" key={department.id}>{department.name}</span>)}
      {position.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}
      <span className="pill">{position.candidateCount} candidates</span>
      <span className="pill">{position.status}</span>
    </div>

    <CandidateStagesPanel positionId={position.id} initialStatus={initialStatus} updatedAt={position.updatedAt} candidateCount={position.candidateCount} onChanged={() => void refreshPosition()} />

    <InviteCandidateModal open={inviteOpen} positionId={position.id} hasTest={Boolean(position.test)} onClose={() => setInviteOpen(false)} onCompleted={() => void refreshPosition()} />

  </div>;
}
