type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const statusTones: Record<string, StatusTone> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "neutral",
  NOT_INVITED: "neutral",
  INVITED: "info",
  IN_PROGRESS: "info",
  TO_BE_EVALUATED: "warning",
  STAGE_1: "warning",
  STAGE_2: "warning",
  STAGE_3: "warning",
  SHORTLISTED: "success",
  ON_HOLD: "warning",
  DISCARDED: "danger",
  HIRED: "success",
  WITHDRAWN: "neutral",
  PENDING: "warning",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

function readableStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

type StatusBadgeProps = {
  status: string;
  label?: string;
  tone?: StatusTone;
};

export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusTones[status.toUpperCase()] ?? "neutral";
  return <span className={`dsBadge dsBadge-${resolvedTone}`}>{label ?? readableStatus(status)}</span>;
}
