"use client";

import { type UserResponse, type UserStatus } from "../lib/user-api";

type UserSummaryCardProps = {
  user: UserResponse;
};

const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "NOT_INVITED", label: "Not invited" },
  { value: "INVITED", label: "Invited" },
  { value: "TO_BE_EVALUATED", label: "To be evaluated" },
  { value: "STAGE_1", label: "Stage 1" },
  { value: "STAGE_2", label: "Stage 2" },
  { value: "STAGE_3", label: "Stage 3" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "DISCARDED", label: "Discarded" },
  { value: "HIRED", label: "Hired" },
  { value: "ON_HOLD", label: "On hold" },
];

function formatFullName(user: Pick<UserResponse, "firstName" | "lastName">) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function UserSummaryCard({ user }: UserSummaryCardProps) {
  const statusLabel =
    user.status.length === 0
      ? "No status"
      : user.status
          .map((entry) => USER_STATUS_OPTIONS.find((option) => option.value === entry)?.label ?? entry)
          .join(", ");

  return (
    <section className="detailCard userSummaryCard">
      <strong>User summary</strong>
      <div className="userSummaryHeader">
        <div>
          <h3>{formatFullName(user)}</h3>
          <p>{user.email}</p>
        </div>
        <span className="pill">{user.role}</span>
      </div>

      <div className="userStatusRow">
        <span className="pill">{statusLabel}</span>
        <span className="pill">{user.assignments.length} assignments</span>
      </div>
    </section>
  );
}
