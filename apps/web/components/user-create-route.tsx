"use client";

import { useState } from "react";
import {
  createUser,
  generateUsers,
  type GenerateUserInput,
  type UserResponse,
  type UserRole,
} from "../lib/user-api";
import { UserSummaryCard } from "./user-summary-card";

export function UserCreateRoute() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("CANDIDATE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUsers, setCreatedUsers] = useState<UserResponse[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedUsers([]);

    try {
      const payload: GenerateUserInput = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        role,
      };
      const [user] = await createUser(payload);
      setCreatedUsers([user]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSamples() {
    setLoading(true);
    setError(null);
    setCreatedUsers([]);

    try {
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const samples: GenerateUserInput[] = Array.from({ length: 10 }, (_, index) => {
        const isRecruiter = index % 3 === 0;

        return {
          firstName: isRecruiter ? "Recruiter" : "Candidate",
          lastName: String(index + 1),
          email: `${isRecruiter ? "recruiter" : "candidate"}-${index + 1}-${seed}@example.com`,
          role: isRecruiter ? "RECRUITER" : "CANDIDATE",
        };
      });

      const created = await generateUsers({ users: samples });
      setCreatedUsers(created);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to generate sample users");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Create user</span>
          <h2>Generate a recruiter or candidate</h2>
        </div>
        <p>Create one user record at a time. The backend normalizes the email and enforces uniqueness.</p>
      </div>

      <form className="formGrid" onSubmit={handleSubmit}>
        <label className="field">
          <span>First name</span>
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Ava" required />
        </label>

        <label className="field">
          <span>Last name</span>
          <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Chen" required />
        </label>

        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ava@example.com" required />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="CANDIDATE">Candidate</option>
            <option value="RECRUITER">Recruiter</option>
          </select>
        </label>

        <div className="fieldWide actionsRow">
          <button className="primaryButton" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create user"}
          </button>
          <button
            className="ghostButton"
            type="button"
            onClick={() => void handleGenerateSamples()}
            disabled={loading}
          >
            Generate 10 sample users
          </button>
          <span className="helperText">Duplicate email requests return a conflict.</span>
        </div>
      </form>

      <div className="feedbackArea">
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {createdUsers.length > 0 && (
          <div className="userGrid">
            {createdUsers.map((user) => (
              <UserSummaryCard key={user.id} user={user} />
            ))}
          </div>
        )}
        {!error && createdUsers.length === 0 && !loading && (
          <div className="stateCard emptyStateInline">No user has been created in this session yet.</div>
        )}
      </div>
    </section>
  );
}
