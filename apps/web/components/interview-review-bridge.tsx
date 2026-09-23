"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttemptDetailResponse } from "../lib/attempt-api";
import { getPosition } from "../lib/position-api";
import { Button, ButtonLink } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";

const STATUSES = ["INVITED", "TO_EVALUATE", "PHASE_1", "PHASE_2", "PHASE_3", "DISCARDED"] as const;
type WorkflowStatus = typeof STATUSES[number];
type Interview = {
  id: string; inviteToken: string | null; invitedAt: string;
  workflowStatus: WorkflowStatus; workflowRevision: number; allowedTransitions: WorkflowStatus[];
  candidate: { name: string; email: string };
  attempt: { id: string; status: string; submittedAt: string | null; scoreSum: number | null } | null;
};
type Pipeline = { interviews: Array<{ id: string }> };
type FeedbackResult = { id: string; score: number; evaluatorComment: string | null; evaluatedAt: string; scoreSum: number; scoreState: string };

const label = (value: string) => value.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const slug = (value: WorkflowStatus) => value.toLowerCase().replaceAll("_", "-");
const statusFromQuery = (value?: string) => STATUSES.find((item) => slug(item) === value || item === value);
const transitions = (status: WorkflowStatus): WorkflowStatus[] => status === "INVITED"
  ? ["DISCARDED"]
  : status === "DISCARDED"
    ? ["TO_EVALUATE", "PHASE_1", "PHASE_2", "PHASE_3"]
    : ["TO_EVALUATE", "PHASE_1", "PHASE_2", "PHASE_3", "DISCARDED"].filter((item) => item !== status) as WorkflowStatus[];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json() as T & { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
    throw new Error(message ?? "Request failed");
  }
  return payload;
}

export function InterviewReviewBridge({ positionId, interviewId, status }: {
  positionId: string; interviewId: string; status?: string;
}) {
  const router = useRouter();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [positionTitle, setPositionTitle] = useState("Position");
  const [attempt, setAttempt] = useState<AttemptDetailResponse | null>(null);
  const [navigationIds, setNavigationIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const requestedStatus = statusFromQuery(status);
  const currentResponse = attempt?.responses[activeIndex] ?? null;
  const navigationStatus = requestedStatus ?? interview?.workflowStatus;
  const backHref = `/positions/${encodeURIComponent(positionId)}${navigationStatus ? `?status=${slug(navigationStatus)}` : ""}`;

  useEffect(() => {
    let cancelled = false;
    void getPosition(positionId).then((position) => { if (!cancelled) setPositionTitle(position.title); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [positionId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const loadedInterview = await request<Interview>(`/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interviewId)}`);
        const listStatus = requestedStatus ?? loadedInterview.workflowStatus;
        const [loadedAttempt, pipeline] = await Promise.all([
          loadedInterview.attempt ? request<AttemptDetailResponse>(`/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interviewId)}/review`) : Promise.resolve(null),
          request<Pipeline>(`/api/positions/${encodeURIComponent(positionId)}/candidates?status=${listStatus}&sort=INVITED_DESC`),
        ]);
        if (!cancelled) {
          setInterview(loadedInterview); setAttempt(loadedAttempt);
          setNavigationIds(pipeline.interviews.map((item) => item.id)); setActiveIndex(0);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load this interview");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [interviewId, positionId, requestedStatus]);

  useEffect(() => {
    setScore(currentResponse?.score === null || currentResponse?.score === undefined ? "" : String(currentResponse.score));
    setComment(currentResponse?.evaluatorComment ?? ""); setSaveMessage("");
  }, [currentResponse]);

  useEffect(() => {
    if (!currentResponse || currentResponse.type !== "VIDEO") { setVideoUrl(null); return; }
    let cancelled = false;
    let objectUrl: string | null = null;
    const path = `/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interviewId)}/responses/${encodeURIComponent(currentResponse.id)}/video`;
    void fetch(path, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Video unavailable");
      return response.blob();
    }).then((blob) => {
      objectUrl = URL.createObjectURL(blob); if (!cancelled) setVideoUrl(objectUrl);
    }).catch(() => { if (!cancelled) setVideoUrl(null); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [currentResponse, interviewId, positionId]);

  const navigationIndex = navigationIds.indexOf(interviewId);
  const previousId = navigationIndex > 0 ? navigationIds[navigationIndex - 1] : null;
  const nextId = navigationIndex >= 0 && navigationIndex < navigationIds.length - 1 ? navigationIds[navigationIndex + 1] : null;
  const selectedOptionIds = useMemo(() => new Set(
    currentResponse?.type === "MULTIPLE_CHOICE"
      ? ((currentResponse.item as { selectedOptions?: Array<{ id: string }> }).selectedOptions ?? []).map((item) => item.id)
      : [],
  ), [currentResponse]);
  const scoreSummary = useMemo(() => {
    const scored = (attempt?.responses ?? []).filter((response) => response.score !== null);
    if (scored.length === 0) return null;
    return { average: scored.reduce((sum, response) => sum + (response.score ?? 0), 0) / scored.length, scoredCount: scored.length };
  }, [attempt?.responses]);

  async function changeStatus(nextStatus: WorkflowStatus) {
    if (!interview || nextStatus === interview.workflowStatus) return;
    if (nextStatus === "DISCARDED" && !window.confirm(`Move ${interview.candidate.name} to Discarded?`)) return;
    setChangingStatus(true); setError(null);
    try {
      await request(`/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interview.id)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStatus, expectedStage: interview.workflowStatus, expectedRevision: interview.workflowRevision }),
      });
      setInterview({ ...interview, workflowStatus: nextStatus, workflowRevision: interview.workflowRevision + 1, allowedTransitions: transitions(nextStatus) });
      router.replace(`/positions/${encodeURIComponent(positionId)}/interview/${encodeURIComponent(interview.id)}?status=${slug(nextStatus)}`, { scroll: false });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Status update failed"); }
    finally { setChangingStatus(false); }
  }

  async function saveFeedback() {
    if (!currentResponse) return;
    const numericScore = Number(score);
    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 10) { setSaveMessage("Enter a whole-number score from 1 to 10."); return; }
    setSaving(true); setSaveMessage("");
    try {
      const saved = await request<FeedbackResult>(`/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interviewId)}/responses/${encodeURIComponent(currentResponse.id)}/feedback`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: numericScore, comment }),
      });
      setAttempt((current) => current ? {
        ...current, scoreSum: saved.scoreSum, scoreState: saved.scoreState,
        responses: current.responses.map((item) => item.id === saved.id ? { ...item, score: saved.score, evaluatorComment: saved.evaluatorComment } : item),
      } : current);
      setSaveMessage("Feedback saved.");
    } catch (caught) { setSaveMessage(caught instanceof Error ? caught.message : "Feedback could not be saved"); }
    finally { setSaving(false); }
  }

  if (loading) return <FeedbackState kind="loading" title="Loading interview" description="Retrieving the candidate responses." />;
  if (error && !interview) return <FeedbackState kind="error" title="Interview unavailable" description={error} actions={<ButtonLink href={backHref} variant="secondary">Back to pipeline</ButtonLink>} />;
  if (!interview) return null;

  return <div className="reviewReferencePage">
    <nav className="reviewBreadcrumb" aria-label="Breadcrumb"><ButtonLink href={backHref} variant="ghost" size="small">← Back to position</ButtonLink><span>/</span><strong>{positionTitle}</strong><span>/</span><strong>{interview.candidate.name}</strong></nav>
    {error && <FeedbackState kind="error" title="Interview could not be updated" description={error} />}
    <div className="reviewReferenceGrid">
      <aside className="reviewReferenceSidebar" aria-label="Candidate and review">
        <section className="reviewReferenceCard reviewCandidateCard">
          <span className="sectionLabel">Candidate</span><h1>{interview.candidate.name}</h1>
          <a href={`mailto:${interview.candidate.email}`} className="reviewCandidateEmail">✉ {interview.candidate.email}</a>
          <dl><div><dt>Invited</dt><dd>{new Date(interview.invitedAt).toLocaleString()}</dd></div><div><dt>Completed</dt><dd>{interview.attempt?.submittedAt ? new Date(interview.attempt.submittedAt).toLocaleString() : "Not completed"}</dd></div></dl>
          <label className="interviewStatusControl"><span>Workflow status</span><select value={interview.workflowStatus} disabled={changingStatus} onChange={(event) => void changeStatus(event.target.value as WorkflowStatus)}><option value={interview.workflowStatus}>{label(interview.workflowStatus)}</option>{interview.allowedTransitions.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        </section>
        <section className="reviewReferenceCard reviewYourReview">
          <h2>Your review</h2><p className="reviewSecondaryText">Feedback for the selected answer</p>
          {currentResponse && (currentResponse.type === "SHORT_ANSWER" || currentResponse.type === "VIDEO") ? <>
            <fieldset className="reviewStarField"><legend>Score (1–10)</legend><div className="reviewStarRating">{Array.from({ length: 5 }, (_, index) => {
              const value = Number(score);
              const fill = value >= (index + 1) * 2 ? "full" : value >= index * 2 + 1 ? "half" : "empty";
              return <span className="reviewStar" data-fill={fill} key={index}><span aria-hidden="true">★</span><button type="button" className="reviewStarHalf" aria-label={`Score ${index * 2 + 1} out of 10`} aria-pressed={value === index * 2 + 1} onClick={() => setScore(String(index * 2 + 1))} /><button type="button" className="reviewStarHalf" aria-label={`Score ${index * 2 + 2} out of 10`} aria-pressed={value === index * 2 + 2} onClick={() => setScore(String(index * 2 + 2))} /></span>;
            })}</div></fieldset>
            <label className="reviewCommentLabel"><span>Comments</span><textarea rows={5} maxLength={5000} placeholder="Write your comments here" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
            <Button loading={saving} onClick={() => void saveFeedback()}>Save review</Button>{saveMessage && <p role="status" className="reviewSaveMessage">{saveMessage}</p>}
          </> : <p className="reviewSecondaryText">Select a video or short answer to leave feedback.</p>}
        </section>
        <section className="reviewReferenceCard"><h2>Review summary</h2><p className="reviewSecondaryText">{scoreSummary ? `${scoreSummary.scoredCount} answers scored · ${scoreSummary.average.toFixed(1)} / 10 average` : "No answers scored yet."}</p></section>
      </aside>
      <section className="reviewReferenceMain">
        {!attempt ? <FeedbackState kind="empty" title="No response to review" description="This candidate has not started an interview attempt yet." /> : attempt.responses.length === 0 ? <FeedbackState kind="empty" title="No submitted answers" description="This attempt does not contain any responses." /> : <>
          <div className="reviewAnswerTop"><span>{interview.attempt?.submittedAt ? new Date(interview.attempt.submittedAt).toLocaleString() : "Interview in progress"}</span><span>{activeIndex + 1} of {attempt.responses.length} answers</span></div>
          <section className="reviewMediaCard" aria-label="Selected answer">
            {currentResponse?.type === "VIDEO" ? (videoUrl ? <video className="reviewVideoPlayer" controls playsInline src={videoUrl} /> : <div className="reviewVideoUnavailable">Playable video is unavailable.</div>) : <div className="reviewTextAnswer"><span className="sectionLabel">Candidate answer</span>{currentResponse?.type === "SHORT_ANSWER" ? <p>{String((currentResponse.item as { textValue?: string }).textValue ?? "") || "No text submitted."}</p> : currentResponse?.type === "MULTIPLE_CHOICE" ? <ul className="reviewOptionList">{((currentResponse.item as { options?: Array<{ id: string; label: string; value: string; isCorrect: boolean }> }).options ?? []).map((option) => { const selected = selectedOptionIds.has(option.id); return <li key={option.id} className={`${selected ? "candidateSelected" : ""} ${option.isCorrect ? "correctAnswer" : ""}`}><span aria-hidden="true">{option.isCorrect ? "✓" : selected ? "●" : "○"}</span><span><strong>{option.label}</strong>{option.value !== option.label && <small>{option.value}</small>}</span><span className="optionLabels">{selected && <em>Candidate selected</em>}{option.isCorrect && <em>Correct answer</em>}</span></li>; })}</ul> : null}</div>}
            <div className="reviewQuestionDetail"><div><span className="sectionLabel">Answer {activeIndex + 1} of {attempt.responses.length}</span><h2>{currentResponse?.questionTitle}</h2><p>{currentResponse?.questionDescription}</p></div><strong>{currentResponse?.score == null ? "Not scored" : `${currentResponse.score}/10`}</strong></div>
            <div className="reviewAnswerControls"><Button variant="secondary" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>← Previous answer</Button><Button variant="secondary" disabled={activeIndex === attempt.responses.length - 1} onClick={() => setActiveIndex((index) => index + 1)}>Next answer →</Button></div>
          </section>
          <details className="reviewQuestionList"><summary>All questions and answers</summary><ol>{attempt.responses.map((response, index) => <li key={response.id}><button type="button" className={index === activeIndex ? "active" : ""} aria-current={index === activeIndex ? "step" : undefined} onClick={() => setActiveIndex(index)}>{index + 1}. {response.questionTitle}<small>{response.score == null ? "Not scored" : `${response.score}/10`}</small></button></li>)}</ol></details>
        </>}
      </section>
      <aside className="reviewReferenceTranscript" aria-label="Transcript"><h2>▤ Transcript</h2><div className="reviewTranscriptPending"><strong>Transcript coming later</strong><p>Video responses can be reviewed now. Transcription will be added in a later stage.</p></div></aside>
    </div>
    <nav className="reviewFloatingNavigation" aria-label="Candidate navigation"><div>{previousId && <ButtonLink variant="secondary" href={`/positions/${encodeURIComponent(positionId)}/interview/${encodeURIComponent(previousId)}?status=${slug(navigationStatus ?? interview.workflowStatus)}`}>← Previous</ButtonLink>}</div><span>{navigationIndex >= 0 ? `${navigationIndex + 1} of ${navigationIds.length}` : "Current candidate"}</span><div>{nextId && <ButtonLink variant="secondary" href={`/positions/${encodeURIComponent(positionId)}/interview/${encodeURIComponent(nextId)}?status=${slug(navigationStatus ?? interview.workflowStatus)}`}>Next candidate →</ButtonLink>}</div></nav>
  </div>;
}
