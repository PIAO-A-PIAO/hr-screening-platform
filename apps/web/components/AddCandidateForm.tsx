"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export function AddCandidateForm({ jobId, disabled }: { jobId: string; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setError("");
    const form = new FormData(formElement);
    try {
      await api(`/jobs/${jobId}/candidates`, {
        method: "POST",
        body: JSON.stringify({ firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email") }),
      });
      formElement.reset();
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not invite candidate"); }
    finally { setBusy(false); }
  }
  return (
    <form className="formGrid" onSubmit={submit}>
      <div className="split">
        <div className="field"><label>First name</label><input name="firstName" required disabled={disabled} /></div>
        <div className="field"><label>Last name</label><input name="lastName" required disabled={disabled} /></div>
      </div>
      <div className="field"><label>Email</label><input name="email" type="email" required disabled={disabled} /></div>
      {error && <div className="error">{error}</div>}
      <div><button className="button" disabled={disabled || busy}>{busy ? "Inviting…" : "Create invitation"}</button></div>
    </form>
  );
}
