"use client";

import { FormEvent, useEffect, useState } from "react";
import { getAttempt, type AttemptDetailResponse } from "../lib/attempt-api";
import { getResponseVideoBlob } from "../lib/response-api";

type AttemptViewRouteProps = {
  initialAttemptId?: string;
  initialInviteToken?: string;
};

type AttemptVideoItem = {
  video?: {
    assetId: string;
    mimeType: string;
    size: number;
    durationSeconds: number | null;
    checksum: string;
    createdAt: string;
  } | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "Unknown";
  }

  if (!Number.isFinite(seconds)) {
    return "Unknown";
  }

  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return minutes > 0 ? `${minutes}m ${remainder.toString().padStart(2, "0")}s` : `${remainder}s`;
}

export function AttemptViewRoute({
  initialAttemptId = "",
  initialInviteToken = "",
}: AttemptViewRouteProps) {
  const [attemptId, setAttemptId] = useState(initialAttemptId);
  const [inviteToken, setInviteToken] = useState(initialInviteToken);
  const [submittedId, setSubmittedId] = useState("");
  const [submittedToken, setSubmittedToken] = useState("");
  const [attempt, setAttempt] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoPreviewUrls, setVideoPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!submittedId || !submittedToken) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAttempt(null);

      try {
        const loaded = await getAttempt(submittedId, submittedToken);
        if (!cancelled) {
          setAttempt(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load attempt");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [submittedId, submittedToken]);

  useEffect(() => {
    const currentAttempt = attempt;
    if (!currentAttempt || !submittedToken) {
      setVideoPreviewUrls({});
      return;
    }

    let cancelled = false;
    const objectUrls: string[] = [];
    const videoResponses = currentAttempt.responses.filter(
      (response) => response.type === "VIDEO" && (response.item as AttemptVideoItem).video,
    );

    async function loadVideoPreviews() {
      const nextEntries = await Promise.all(
        videoResponses.map(async (response) => {
          try {
            const blob = await getResponseVideoBlob(response.id, submittedToken);
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return [response.id, url] as const;
          } catch {
            return [response.id, null] as const;
          }
        }),
      );

      if (!cancelled) {
        setVideoPreviewUrls(
          Object.fromEntries(nextEntries.filter((entry): entry is readonly [string, string] => entry[1] !== null)),
        );
      }
    }

    void loadVideoPreviews();

    return () => {
      cancelled = true;
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [attempt, submittedToken]);

  useEffect(() => {
    if (!initialAttemptId || !initialInviteToken) {
      return;
    }

    setAttemptId(initialAttemptId);
    setInviteToken(initialInviteToken);
    setSubmittedId(initialAttemptId);
    setSubmittedToken(initialInviteToken);
  }, [initialAttemptId, initialInviteToken]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedId(attemptId.trim());
    setSubmittedToken(inviteToken.trim());
  }

  return (
    <section className="panel candidateAnswerShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Attempt view</span>
          <h2>View a submitted attempt</h2>
        </div>
        <p>Submitted attempts remain private and require the matching invitation token.</p>
      </div>

      <form className="formGrid" onSubmit={submit}>
        <label className="field">
          <span>Attempt ID</span>
          <input value={attemptId} onChange={(event) => setAttemptId(event.target.value)} />
        </label>
        <label className="field">
          <span>Invite token</span>
          <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
        </label>
        <div className="actionsRow">
          <button className="primaryButton" type="submit" disabled={loading || !attemptId.trim() || !inviteToken.trim()}>
            {loading ? "Loading..." : "Load attempt"}
          </button>
        </div>
      </form>

      {error && <div className="stateCard errorState">{error}</div>}
      {attempt && (
        <div className="detailCard">
          <div className="pillRow">
            <span className="pill">{attempt.status.replaceAll("_", " ")}</span>
            <span className="pill">Score: {attempt.scoreSum ?? "Not scored"}</span>
            <span className="pill">Responses: {attempt.responseCount}</span>
          </div>
          <h3>Attempt {attempt.id}</h3>
          <p>Candidate: {attempt.candidate.name} ({attempt.candidate.email})</p>
          <p>Test: {attempt.test.name}</p>
          <p>Started: {new Date(attempt.startedAt).toLocaleString()}</p>
          <p>{attempt.submittedAt ? `Submitted: ${new Date(attempt.submittedAt).toLocaleString()}` : "Not submitted"}</p>

          <div className="stack">
            {attempt.responses.map((response) => (
              <div className="stateCard" key={response.id}>
                <div className="pillRow">
                  <span className="pill">{response.type.replaceAll("_", " ")}</span>
                  <span className="pill">Score: {response.score ?? "Not scored"}</span>
                </div>
                <strong>{response.questionTitle}</strong>
                <p>Response ID: {response.id}</p>
                {response.type === "SHORT_ANSWER" && (
                  <div className="stateCard">{String((response.item as { textValue?: string }).textValue ?? "")}</div>
                )}
                {response.type === "MULTIPLE_CHOICE" && (
                  <ul>
                    {((response.item as { selectedOptions?: Array<{ id: string; label: string; value: string }> }).selectedOptions ?? []).map((option) => (
                      <li key={option.id}>
                        {option.label} ({option.value})
                      </li>
                    ))}
                  </ul>
                )}
                {response.type === "VIDEO" && (
                  <div className="attemptVideoLayout">
                    <div className="stateCard attemptVideoPreviewCard">
                      <strong>Video preview</strong>
                      {videoPreviewUrls[response.id] ? (
                        <video
                          className="mediaFrame attemptVideoFrame"
                          controls
                          playsInline
                          src={videoPreviewUrls[response.id]}
                        />
                      ) : (
                        <div className="mediaEmpty">Video preview unavailable.</div>
                      )}
                    </div>

                    <div className="stateCard attemptVideoMetaCard">
                      <strong>Video metadata</strong>
                      {(() => {
                        const video = (response.item as AttemptVideoItem).video;
                        return video ? (
                          <div className="attemptVideoMetaGrid">
                            <div>
                              <span>Mime type</span>
                              <small>{video.mimeType}</small>
                            </div>
                            <div>
                              <span>Size</span>
                              <small>{formatBytes(video.size)}</small>
                            </div>
                            <div>
                              <span>Duration</span>
                              <small>{formatDuration(video.durationSeconds)}</small>
                            </div>
                            <div>
                              <span>Checksum</span>
                              <small>{video.checksum}</small>
                            </div>
                            <div>
                              <span>Uploaded</span>
                              <small>{new Date(video.createdAt).toLocaleString()}</small>
                            </div>
                          </div>
                        ) : (
                          <div className="mediaEmpty">No video asset was stored for this response.</div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
