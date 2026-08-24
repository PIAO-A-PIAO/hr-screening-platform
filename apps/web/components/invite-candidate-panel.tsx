"use client";

import { useEffect, useState } from "react";
import { inviteUsers, listUsers, type UserResponse } from "../lib/user-api";
import type { PositionResponse } from "../lib/position-api";

type InviteCandidatePanelProps = {
  position: PositionResponse;
  className?: string;
  onInvited?: () => void;
};

function splitName(user: UserResponse) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function InviteCandidatePanel({ position, className, onInvited }: InviteCandidatePanelProps) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToken, setSuccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoadingUsers(true);
      setError(null);

      try {
        const loaded = await listUsers("CANDIDATE");
        if (!cancelled) {
          setUsers(loaded);
          setSelectedUserId((current) => current || loaded[0]?.id || "");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load candidates");
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingInvite(true);
    setError(null);
    setSuccessToken(null);

    try {
      if (!position.test) {
        throw new Error("Attach a test before inviting candidates.");
      }

      const selected = users.find((user) => user.id === selectedUserId);
      if (!selected) {
        throw new Error("Select a candidate to invite.");
      }

      const invited = await inviteUsers({
        users: [
          {
            firstName: selected.firstName,
            lastName: selected.lastName,
            email: selected.email,
            role: "CANDIDATE",
            testIds: [position.test.id],
          },
        ],
      });

      const assignment = invited[0]?.assignments.find((entry) => entry.testId === position.test?.id);
      const token = assignment?.inviteToken;

      if (!token) {
        throw new Error("Invitation was created, but no invite token was returned.");
      }

      setSuccessToken(token);
      onInvited?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to invite candidate");
    } finally {
      setLoadingInvite(false);
    }
  }

  const canInvite = Boolean(position.test && selectedUserId);

  return (
    <section className={`detailCard ${className ?? ""}`}>
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Invite candidate</span>
          <h3>Generate an invitation token</h3>
        </div>
        <p>Select a candidate and create a test invitation for the current position.</p>
      </div>

      {!position.test && (
        <div className="emptyStateInline">
          Attach a test to this position before inviting a candidate.
        </div>
      )}

      {loadingUsers && <div>Loading candidates...</div>}
      {error && <div className="errorState">Error: {error}</div>}

      {!loadingUsers && users.length === 0 && (
        <div className="emptyStateInline">No candidate users are available yet.</div>
      )}

      {users.length > 0 && (
        <form className="formGrid" onSubmit={handleInvite}>
          <label className="field">
            <span>Candidate</span>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={loadingInvite}
            >
              <option value="" disabled>
                Select a candidate
              </option>
              {users.map((user) => (
                <option value={user.id} key={user.id}>
                  {splitName(user)} - {user.email}
                </option>
              ))}
            </select>
          </label>

          <div className="actionsRow">
            <button className="primaryButton" type="submit" disabled={loadingInvite || !canInvite}>
              {loadingInvite ? "Generating..." : "Generate invitation token"}
            </button>
            <span className="helperText">
              The token is created for the selected candidate and this position's test.
            </span>
          </div>
        </form>
      )}

      {successToken && (
        <div className="successState">
          <strong>Invitation created.</strong>
          <span>Invite token: {successToken}</span>
        </div>
      )}
    </section>
  );
}
