"use client";

import { useEffect, useState } from "react";
import { AttemptViewRoute } from "./attempt-view-route";
import { ButtonLink } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";

type InterviewReviewBridgeProps = {
  positionId: string;
  interviewId: string;
  status?: string;
};

type Interview = {
  id: string;
  inviteToken: string;
  workflowStatus: string;
  candidate: { name: string; email: string };
  attempt: { id: string; status: string } | null;
};

export function InterviewReviewBridge({ positionId, interviewId, status }: InterviewReviewBridgeProps) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backHref = `/positions/${encodeURIComponent(positionId)}${status ? `?status=${encodeURIComponent(status)}` : ""}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interviewId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as Interview & { message?: string | string[] };
        if (!response.ok) {
          const message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
          throw new Error(message ?? "Unable to load this interview");
        }
        if (!cancelled) setInterview(payload);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load this interview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [interviewId, positionId]);

  if (loading) {
    return <FeedbackState kind="loading" title="Loading interview" description="Retrieving the candidate response." />;
  }

  if (error || !interview) {
    return (
      <FeedbackState
        kind="error"
        title="Interview unavailable"
        description={error ?? "The interview could not be found."}
        actions={<ButtonLink href={backHref} variant="secondary">Back to pipeline</ButtonLink>}
      />
    );
  }

  return (
    <div className="interviewReviewPage">
      <header className="pipelinePageHeader">
        <div>
          <ButtonLink href={backHref} variant="ghost" size="small">Back to pipeline</ButtonLink>
          <span className="sectionLabel">Candidate interview</span>
          <h1>{interview.candidate.name}</h1>
          <p>{interview.candidate.email} · {interview.workflowStatus.replaceAll("_", " ")}</p>
        </div>
      </header>

      {interview.attempt ? (
        <AttemptViewRoute initialAttemptId={interview.attempt.id} initialInviteToken={interview.inviteToken} />
      ) : (
        <FeedbackState
          kind="empty"
          title="No response to review"
          description="This candidate has not started an interview attempt yet."
          actions={<ButtonLink href={backHref} variant="secondary">Back to pipeline</ButtonLink>}
        />
      )}
    </div>
  );
}
