"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPosition, type CreatePositionInput, type PositionStatus } from "../lib/position-api";

export function PositionCreateRoute() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<PositionStatus>("DRAFT");
  const [createTestNow, setCreateTestNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: CreatePositionInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        department: department.trim(),
        location: location.trim(),
        owner: owner.trim(),
        status,
      };

      const created = await createPosition(payload);

      if (createTestNow) {
        router.push(`/positions/${encodeURIComponent(created.id)}`);
        return;
      }

      router.push(`/positions/${encodeURIComponent(created.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create position");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Create position</span>
          <h2>Build a draft or open role</h2>
        </div>
        <p>Create the position first, then optionally attach a screening test in the next step.</p>
      </div>

      <form className="formGrid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Senior recruiter" required />
        </label>

        <label className="field">
          <span>Owner</span>
          <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="HR team" required />
        </label>

        <label className="field fieldWide">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional role summary and hiring context."
          />
        </label>

        <label className="field">
          <span>Department</span>
          <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="People Operations" required />
        </label>

        <label className="field">
          <span>Location</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote / Port-au-Prince" required />
        </label>

        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as PositionStatus)}>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="ON_HOLD">On hold</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>

        <label className="field fieldWide checkRow createTestToggle">
          <input
            type="checkbox"
            checked={createTestNow}
            onChange={(event) => setCreateTestNow(event.target.checked)}
          />
          <span>Create a screening test for this position right after saving</span>
        </label>

        <div className="fieldWide actionsRow">
          <button className="primaryButton" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create position"}
          </button>
          <span className="helperText">
            Draft positions can stay test-free until the hiring team is ready to attach a screening flow.
          </span>
        </div>
      </form>

      {error && (
        <div className="feedbackArea">
          <div className="stateCard errorState">Error: {error}</div>
        </div>
      )}
    </section>
  );
}
