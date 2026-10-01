"use client";

import { useEffect, useState } from "react";
import { CandidateOnAir } from "../../../../components/candidate-onair";
import { resolveInviteToken } from "../../../../lib/attempt-api";

export default function Page({ params }: { params: Promise<{ invitationToken: string }> }) {
  const [invitation, setInvitation] = useState<{ token: string; testId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ invitationToken }) => {
      const resolved = await resolveInviteToken(invitationToken);
      if (!cancelled) setInvitation({ token: invitationToken, testId: resolved.testId });
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to open interview.");
    });
    return () => { cancelled = true; };
  }, [params]);

  if (error) return <main className="onairShell"><div className="onairError" role="alert">{error}</div></main>;
  if (!invitation) return <main className="onairShell"><div role="status">Loading interview…</div></main>;
  return <CandidateOnAir testId={invitation.testId} inviteToken={invitation.token} />;
}
