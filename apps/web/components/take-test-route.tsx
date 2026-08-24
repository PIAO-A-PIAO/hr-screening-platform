"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveInviteToken } from "../lib/attempt-api";

export function TakeTestRoute() {
  const router = useRouter();
  const [inviteToken, setInviteToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = inviteToken.trim();
    if (!token) {
      setError("Enter an invitation token.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolved = await resolveInviteToken(token);
      router.push(`/tests/${encodeURIComponent(resolved.testId)}?inviteToken=${encodeURIComponent(token)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to resolve invitation token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Take test</span>
          <h2>Open the candidate view</h2>
        </div>
        <p>Enter an invitation token to jump to the assigned test.</p>
      </div>

      <form className="lookupBar" onSubmit={handleSubmit}>
        <input
          value={inviteToken}
          onChange={(event) => setInviteToken(event.target.value)}
          placeholder="Paste invitationToken here"
          autoComplete="off"
          spellCheck={false}
        />
        <button className="primaryButton" type="submit" disabled={loading}>
          {loading ? "Opening..." : "Take the test"}
        </button>
      </form>

      {error && <div className="stateCard errorState">Error: {error}</div>}
    </section>
  );
}
