import Link from "next/link";
import type { PositionSummaryResponse } from "../lib/position-api";

type PositionSummaryCardProps = {
  position: PositionSummaryResponse;
};

export function PositionSummaryCard({ position }: PositionSummaryCardProps) {
  const testLabel = position.test ? `${position.test.status} test` : "No test";

  return (
    <article className="detailCard positionSummaryCard">
      <div className="positionSummaryHeader">
        <div>
          <span className="sectionLabel">{position.department}</span>
          <h3>{position.title}</h3>
        </div>
        <span className="pill">{position.status}</span>
      </div>

      <p>{position.description ?? "No description"}</p>

      <div className="pillRow">
        <span className="pill">{position.location}</span>
        <span className="pill">{position.owner}</span>
        <span className="pill">{position.candidateCount} candidates</span>
        <span className="pill">{position.submittedCount} submitted</span>
        <span className="pill">{testLabel}</span>
      </div>

      <div className="positionSummaryActions">
        <Link className="primaryButton inlineButton" href={`/positions/${encodeURIComponent(position.id)}`}>
          Open position
        </Link>
      </div>
    </article>
  );
}
