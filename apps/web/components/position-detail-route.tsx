"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreateTestPanel } from "./create-test-panel";
import { InviteCandidatePanel } from "./invite-candidate-panel";
import { getPosition, type PositionResponse } from "../lib/position-api";

type PositionDetailRouteProps = {
  positionId: string;
};

function formatStatuses(statuses: string[]) {
  return statuses.length === 0 ? "No status" : statuses.join(", ");
}

function buildAttemptViewHref(candidate: PositionResponse["submittedCandidates"][number]) {
  if (!candidate.attemptId || !candidate.inviteToken) {
    return null;
  }

  return `/attempts/view?attemptId=${encodeURIComponent(candidate.attemptId)}&inviteToken=${encodeURIComponent(candidate.inviteToken)}`;
}

export function PositionDetailRoute({ positionId }: PositionDetailRouteProps) {
  const [position, setPosition] = useState<PositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await getPosition(positionId);
        if (!cancelled) {
          setPosition(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load position");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [positionId]);

  async function refreshPosition() {
    setError(null);
    try {
      const loaded = await getPosition(positionId);
      setPosition(loaded);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to refresh position");
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <div className="stateCard">Loading position...</div>
      </section>
    );
  }

  if (error && !position) {
    return (
      <section className="panel">
        <div className="stateCard errorState">Error: {error}</div>
      </section>
    );
  }

  if (!position) {
    return (
      <section className="panel">
        <div className="stateCard">Position not found.</div>
      </section>
    );
  }

  return (
    <section className="panel positionDetailShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Position detail</span>
          <h2>{position.title}</h2>
        </div>
        <p>{position.description ?? "No description"}</p>
      </div>

      {error && <div className="stateCard errorState">Error: {error}</div>}

      <div className="pillRow">
        <span className="pill">{position.department}</span>
        <span className="pill">{position.location}</span>
        <span className="pill">{position.owner}</span>
        <span className="pill">{position.candidateCount} candidates</span>
        <span className="pill">{position.submittedCount} submitted</span>
        <span className="pill">{position.test ? position.test.status : "No test"}</span>
      </div>

      <div className="positionDetailStack">
        <div className="detailCard">
          <strong>Position data</strong>
          <dl className="positionDataGrid">
            <div>
              <dt>Title</dt>
              <dd>{position.title}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{position.department}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{position.location}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{position.owner}</dd>
            </div>
          </dl>
        </div>

        <CreateTestPanel position={position} className="positionAccordionCard" onSaved={() => void refreshPosition()} />

        <InviteCandidatePanel position={position} className="positionAccordionCard" onInvited={() => void refreshPosition()} />
      </div>

      <div className="detailGrid positionCandidateGrid">
        <div className="detailCard">
          <strong>Submitted attempts</strong>
          {position.submittedCandidates.length === 0 ? (
            <div className="stateCard emptyStateInline">No candidates have submitted yet.</div>
          ) : (
            <ul className="dataList">
              {position.submittedCandidates.map((candidate) => (
                <li key={candidate.id}>
                  {(() => {
                    const href = buildAttemptViewHref(candidate);

                    if (!href) {
                      return (
                        <>
                          <strong>{candidate.name}</strong>
                          <span>{candidate.email}</span>
                          <small>{formatStatuses(candidate.status)}</small>
                          <small>Invited {new Date(candidate.invitedAt).toLocaleString()}</small>
                          <small>{candidate.inviteToken}</small>
                        </>
                      );
                    }

                    return (
                      <Link className="candidateRowLink" href={href}>
                        <strong>{candidate.name}</strong>
                        <span>{candidate.email}</span>
                        <small>{formatStatuses(candidate.status)}</small>
                        <small>Invited {new Date(candidate.invitedAt).toLocaleString()}</small>
                        <small>{candidate.inviteToken}</small>
                      </Link>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detailCard">
          <strong>Invited candidates not yet submitted</strong>
          {position.invitedCandidates.length === 0 ? (
            <div className="stateCard emptyStateInline">No invited candidates remain pending.</div>
          ) : (
            <ul className="dataList">
              {position.invitedCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.email}</span>
                  <small>{formatStatuses(candidate.status)}</small>
                  <small>Invited {new Date(candidate.invitedAt).toLocaleString()}</small>
                  <small>{candidate.inviteToken}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
