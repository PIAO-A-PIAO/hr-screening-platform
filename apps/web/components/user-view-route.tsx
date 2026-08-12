"use client";

import { useEffect, useState } from "react";
import { getUser, type UserResponse, ApiError } from "../lib/user-api";
import { UserSummaryCard } from "./user-summary-card";

type UserViewRouteProps = {
  initialUserId?: string;
  initialInviteToken?: string;
};

export function UserViewRoute({
  initialUserId = "",
  initialInviteToken = "",
}: UserViewRouteProps) {
  const [userId, setUserId] = useState(initialUserId);
  const [inviteToken, setInviteToken] = useState(initialInviteToken);
  const [submittedUserId, setSubmittedUserId] = useState(initialUserId);
  const [submittedInviteToken, setSubmittedInviteToken] = useState(initialInviteToken);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(initialUserId);
    setInviteToken(initialInviteToken);
    setSubmittedUserId(initialUserId);
    setSubmittedInviteToken(initialInviteToken);
  }, [initialUserId, initialInviteToken]);

  useEffect(() => {
    if (!submittedUserId) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await getUser(submittedUserId, submittedInviteToken || undefined);
        if (!cancelled) {
          setUser(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          if (caught instanceof ApiError && caught.status === 403) {
            setError("Unauthorized: invite token required or invalid.");
          } else if (caught instanceof ApiError && caught.status === 404) {
            setError("User not found.");
          } else {
            setError(caught instanceof Error ? caught.message : "Failed to load user");
          }
          setUser(null);
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
  }, [submittedInviteToken, submittedUserId]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedUserId(userId.trim());
    setSubmittedInviteToken(inviteToken.trim());
  }

  return (
    <section className="panel candidateAnswerShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">View user</span>
          <h2>User lookup</h2>
        </div>
        <p>
          Load a user record by ID. Candidate users require a valid invite token; recruiters can be viewed directly.
        </p>
      </div>

      <form className="formGrid userLookupForm" onSubmit={handleSubmit}>
        <label className="field">
          <span>User ID</span>
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="Paste a userId here"
            required
          />
        </label>

        <label className="field">
          <span>Invite token</span>
          <input
            value={inviteToken}
            onChange={(event) => setInviteToken(event.target.value)}
            placeholder="Optional for recruiters, required for candidates"
          />
        </label>

        <div className="fieldWide actionsRow">
          <button className="primaryButton" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Load user"}
          </button>
          <span className="helperText">
            Email is normalized to lowercase in the backend. Duplicate emails are rejected on generate.
          </span>
        </div>
      </form>

      <div className="feedbackArea">
        {!submittedUserId && <div className="stateCard emptyStateInline">Enter a user ID to load the record.</div>}
        {loading && <div className="stateCard">Loading user...</div>}
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {!loading && !error && !user && submittedUserId && (
          <div className="stateCard emptyStateInline">No user returned for that ID.</div>
        )}
      </div>

      {user && <UserSummaryCard user={user} />}
    </section>
  );
}
