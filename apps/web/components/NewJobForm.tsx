"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { Job } from "../lib/types";

export function NewJobForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const job = await api<Job>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          department: form.get("department"),
          location: form.get("location") || undefined,
          description: form.get("description"),
        }),
      });
      router.push(`/jobs/${job.id}/builder`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="formGrid" onSubmit={submit}>
      <div className="field"><label htmlFor="title">Job title</label><input id="title" name="title" placeholder="Senior Software Engineer" required /></div>
      <div className="split">
        <div className="field"><label htmlFor="department">Department</label><input id="department" name="department" placeholder="Engineering" required /></div>
        <div className="field"><label htmlFor="location">Location</label><input id="location" name="location" placeholder="Toronto / Hybrid" /></div>
      </div>
      <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" placeholder="What the role is responsible for…" required /></div>
      {error && <div className="error">{error}</div>}
      <div className="formActions"><button className="button" disabled={busy}>{busy ? "Creating…" : "Create and build interview"}</button></div>
    </form>
  );
}
