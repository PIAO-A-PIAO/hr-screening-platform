"use client";

import { FormEvent, useEffect, useState } from "react";
import { getResponse, getResponseVideoBlob, type ResponseRecord } from "../lib/response-api";

type ResponseViewRouteProps = {
  initialResponseId?: string;
};

export function ResponseViewRoute({ initialResponseId = "" }: ResponseViewRouteProps) {
  const [responseId, setResponseId] = useState(initialResponseId);
  const [inviteToken, setInviteToken] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [submittedToken, setSubmittedToken] = useState("");
  const [response, setResponse] = useState<ResponseRecord | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submittedId || !submittedToken) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      setResponse(null);
      setVideoUrl(null);
      try {
        const loaded = await getResponse(submittedId, submittedToken);
        if (cancelled) return;
        setResponse(loaded);
        const video = loaded.item.video as { assetId?: string } | null | undefined;
        if (loaded.type === "VIDEO" && video?.assetId) {
          const blob = await getResponseVideoBlob(submittedId, submittedToken);
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setVideoUrl(objectUrl);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to load response");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submittedId, submittedToken]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedId(responseId.trim());
    setSubmittedToken(inviteToken.trim());
  }

  const selectedOptions = response?.item.selectedOptions as Array<{ id: string; label: string; value: string }> | undefined;

  return (
    <section className="panel candidateAnswerShell">
      <div className="panelHeader">
        <div><span className="sectionLabel">Milestone 5</span><h2>View a saved response</h2></div>
        <p>Candidate responses remain private and require the matching invitation token.</p>
      </div>

      <form className="formGrid" onSubmit={submit}>
        <label className="field">
          <span>Response ID</span>
          <input value={responseId} onChange={(event) => setResponseId(event.target.value)} />
        </label>
        <label className="field">
          <span>Invite token</span>
          <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
        </label>
        <div className="actionsRow">
          <button className="primaryButton" type="submit" disabled={loading || !responseId.trim() || !inviteToken.trim()}>
            {loading ? "Loading..." : "Load response"}
          </button>
        </div>
      </form>

      {error && <div className="stateCard errorState">{error}</div>}
      {response && (
        <div className="detailCard">
          <div className="pillRow">
            <span className="pill">{response.type.replaceAll("_", " ")}</span>
            <span className="pill">Score: {response.score ?? "Not scored"}</span>
          </div>
          <h3>Response {response.id}</h3>
          <p>Candidate: {response.userId}</p>
          <p>Test: {response.testId}</p>
          <p>Question: {response.questionId}</p>

          {response.type === "SHORT_ANSWER" && <div className="stateCard">{String(response.item.textValue ?? "")}</div>}
          {response.type === "MULTIPLE_CHOICE" && (
            <ul>
              {(selectedOptions ?? []).map((option) => <li key={option.id}>{option.label} ({option.value})</li>)}
            </ul>
          )}
          {response.type === "VIDEO" && (
            videoUrl
              ? <video className="mediaFrame recorderVideo" controls playsInline src={videoUrl} />
              : <div className="stateCard">The response record exists, but no video is attached yet.</div>
          )}
        </div>
      )}
    </section>
  );
}