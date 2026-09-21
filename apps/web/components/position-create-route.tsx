"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPosition, type PositionStatus } from "../lib/position-api";

export function PositionCreateRoute() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<PositionStatus>("OPEN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const created = await createPosition({
        title: title.trim(),
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), status,
      });
      router.push(`/positions/${encodeURIComponent(created.id)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to create position"); }
    finally { setLoading(false); }
  }

  return (
    <section className="panel">
      <div className="panelHeader"><div><span className="sectionLabel">New position</span><h2>Create a position</h2></div><p>Create the position now; test and invitation configuration follow in their dedicated milestones.</p></div>
      <form className="formGrid" onSubmit={handleSubmit}>
        <label className="field fieldWide"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Software Engineer" required /></label>
        <label className="field"><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Engineering, Backend, Toronto" /><small>Separate tags with commas.</small></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as PositionStatus)}><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select></label>
        <div className="fieldWide actionsRow"><button className="primaryButton" type="submit" disabled={loading}>{loading ? "Creating…" : "Create position"}</button></div>
      </form>
      {error && <div className="feedbackArea"><div className="stateCard errorState">Error: {error}</div></div>}
    </section>
  );
}
