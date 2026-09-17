"use client";

import { useEffect, useState } from "react";
import { CandidateStagesPanel } from "./candidate-stages-panel";
import { CreateTestPanel } from "./create-test-panel";
import { InviteCandidatePanel } from "./invite-candidate-panel";
import {
  getPosition,
  type PositionResponse,
} from "../lib/position-api";
import { PositionEmailSequencePanel } from "./position-email-sequence-panel";

type PositionDetailRouteProps = {
  positionId: string;
};

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
        {position.departments.map((department) => <span className="pill" key={department.id}>{department.name}</span>)}
        {position.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}
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
            <div><dt>Departments</dt><dd>{position.departments.map((department) => department.name).join(", ") || "None"}</dd></div>
            <div><dt>Tags</dt><dd>{position.tags.join(", ") || "None"}</dd></div>
            <div><dt>Status</dt><dd>{position.status}</dd></div>
          </dl>
        </div>

        <CreateTestPanel position={position} className="positionAccordionCard" onSaved={() => void refreshPosition()} />

        <InviteCandidatePanel position={position} className="positionAccordionCard" onInvited={() => void refreshPosition()} />

        <PositionEmailSequencePanel position={position} className="positionAccordionCard" onSaved={() => void refreshPosition()} />
      </div>

      <CandidateStagesPanel key={position.id} positionId={position.id} updatedAt={position.updatedAt} candidateCount={position.candidateCount} onChanged={() => void refreshPosition()} />
    </section>
  );
}
