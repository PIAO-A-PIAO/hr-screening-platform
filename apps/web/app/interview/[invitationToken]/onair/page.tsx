"use client";
import { useEffect, useState } from "react";
import { TestAnswerRoute } from "../../../../components/test-answer-route";
import { resolveInviteToken } from "../../../../lib/attempt-api";

export default function Page({ params }: { params: Promise<{ invitationToken: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void params.then(async ({ invitationToken }) => { setToken(invitationToken); try { setTestId((await resolveInviteToken(invitationToken)).testId); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to open interview"); } }); }, [params]);
  if (error) return <main className="pageShell"><div className="stateCard errorState">{error}</div></main>;
  if (!token || !testId) return <main className="pageShell"><div className="stateCard">Loading interview…</div></main>;
  return <TestAnswerRoute testId={testId} inviteToken={token} />;
}
