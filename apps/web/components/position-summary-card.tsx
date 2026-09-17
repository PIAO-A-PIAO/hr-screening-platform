import Link from "next/link";
import type { PositionSummaryResponse } from "../lib/position-api";
import { AppIcon } from "./ui/app-icon";
import { ButtonLink } from "./ui/button";
import { StatusBadge } from "./ui/status-badge";

type PositionSummaryCardProps = {
  position: PositionSummaryResponse;
};

export function PositionSummaryCard({ position }: PositionSummaryCardProps) {
  const updated = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(position.updatedAt));
  const testLabel = position.test
    ? `${position.test.status === "PUBLISHED" ? "Published" : "Draft"} test`
    : "No test";
  const testTone = position.testState === "PUBLISHED" ? "success" : position.test ? "warning" : "neutral";

  return (
    <article className="positionRow">
      <div className="positionRowIdentity">
        <div className="positionRowTitle">
          <Link href={`/positions/${encodeURIComponent(position.id)}`}>{position.title}</Link>
          <StatusBadge status={position.status} />
        </div>
        <p>{position.description ?? "No position description has been added."}</p>
        <div className="positionRowMeta">
          <span>{position.department}</span>
          <span>{position.location}</span>
          <span>Owner: {position.owner}</span>
        </div>
      </div>

      <div className="positionRowTest">
        <span>Interview test</span>
        <StatusBadge status={position.testState} label={testLabel} tone={testTone} />
        <small>{position.test ? `${position.test.questionCount} questions` : "Setup required"}</small>
      </div>

      <div className="positionRowNumber">
        <span><AppIcon name="people" size={17} /> Candidates</span>
        <strong>{position.candidateCount}</strong>
      </div>

      <div className="positionRowNumber">
        <span><AppIcon name="review" size={17} /> Submitted</span>
        <strong>{position.submittedCount}</strong>
      </div>

      <div className="positionRowAction">
        <small>Updated {updated}</small>
        <ButtonLink href={`/positions/${encodeURIComponent(position.id)}`} variant="secondary" size="small" trailingIcon={<AppIcon name="arrow" size={16} />}>
          View Position
        </ButtonLink>
      </div>
    </article>
  );
}
