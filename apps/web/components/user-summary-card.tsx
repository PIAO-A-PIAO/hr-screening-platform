"use client";

import { useState } from "react";
import { deleteUser, type UserResponse, type UserStatus } from "../lib/user-api";

type UserSummaryCardProps = {
  user: UserResponse;
  onDeleted?: (userId: string) => void;
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

export function UserSummaryCard({ user, onDeleted }: UserSummaryCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(`Delete ${formatFullName(user)}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteUser(user.id);
      setIsDeleted(true);
      onDeleted?.(user.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  if (isDeleted) {
    return null;
  }

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
          <small>{user.id}</small>
        </div>
        <span className="pill">{user.role}</span>
      </div>

      <div className="userStatusRow">
        <span className="pill">{statusLabel}</span>
        <span className="pill">{user.assignments.length} assignments</span>
      </div>

      {error && <div className="inlineStatus errorText">Error: {error}</div>}

      <button
        className="iconButton dangerIconButton"
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        aria-label="Delete user"
        title={deleting ? "Deleting..." : "Delete user"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="trashIcon"><path d="M9 3h6a1 1 0 0 1 1 1v1h4v2H4V5h4V4a1 1 0 0 1 1-1Zm1 2h4V5h-4V5Zm-2 5h2v7H8v-7Zm4 0h2v7h-2v-7Zm4 0h2v7h-2v-7ZM6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" /></svg>
      </button>
    </section>
  );
}
