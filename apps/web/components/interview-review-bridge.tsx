"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAttempt, type AttemptDetailResponse } from "../lib/attempt-api";
import { getResponseVideoBlob } from "../lib/response-api";
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
    async function load() {
      setLoading(true); setError(null);
      try {
        const loadedInterview = await request<Interview>(`/api/positions/${encodeURIComponent(positionId)}/candidates/${encodeURIComponent(interviewId)}`);
        const listStatus = requestedStatus ?? loadedInterview.workflowStatus;
        const [loadedAttempt, pipeline] = await Promise.all([
          loadedInterview.attempt && loadedInterview.inviteToken ? getAttempt(loadedInterview.attempt.id, loadedInterview.inviteToken) : Promise.resolve(null),
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
    if (!currentResponse || currentResponse.type !== "VIDEO" || !interview?.inviteToken) { setVideoUrl(null); return; }
    let cancelled = false;
    let objectUrl: string | null = null;
    void getResponseVideoBlob(currentResponse.id, interview.inviteToken).then((blob) => {
      objectUrl = URL.createObjectURL(blob); if (!cancelled) setVideoUrl(objectUrl);
    }).catch(() => { if (!cancelled) setVideoUrl(null); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [currentResponse, interview?.inviteToken]);

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

  return <div className="interviewReviewPage">
    <ButtonLink href={backHref} variant="ghost" size="small">← Back to position</ButtonLink>
    <header className="interviewCandidateHeader">
      <div><span className="sectionLabel">Candidate interview</span><h1>{interview.candidate.name}</h1><p>{interview.candidate.email}</p></div>
      <dl><div><dt>Completed</dt><dd>{interview.attempt?.submittedAt ? new Date(interview.attempt.submittedAt).toLocaleString() : "Not completed"}</dd></div></dl>
      <label className="interviewStatusControl"><span>Workflow status</span><select value={interview.workflowStatus} disabled={changingStatus} onChange={(event) => void changeStatus(event.target.value as WorkflowStatus)}><option value={interview.workflowStatus}>{label(interview.workflowStatus)}</option>{interview.allowedTransitions.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
    </header>
    {error && <FeedbackState kind="error" title="Interview could not be updated" description={error} />}
    {!attempt ? <FeedbackState kind="empty" title="No response to review" description="This candidate has not started an interview attempt yet." /> : attempt.responses.length === 0 ? <FeedbackState kind="empty" title="No submitted answers" description="This attempt does not contain any responses." /> : <>
      <div className="interviewReviewArea">
        <nav className="interviewQuestionRail" aria-label="Interview questions"><span className="sectionLabel">Questions</span><div className="interviewAverageScore" aria-label={scoreSummary ? `Average score ${scoreSummary.average.toFixed(1)} out of 10, based on ${scoreSummary.scoredCount} scored responses` : "No responses have been scored yet"}><span>Average score</span><strong>{scoreSummary ? `${scoreSummary.average.toFixed(1)} / 10` : "Not scored"}</strong></div><ol>{attempt.responses.map((response, index) => <li key={response.id}><button type="button" className={index === activeIndex ? "active" : ""} aria-current={index === activeIndex ? "step" : undefined} onClick={() => setActiveIndex(index)}><span>{index + 1}</span><span>{response.questionTitle}<small>{label(response.type)}</small></span><strong className="interviewQuestionScore" aria-label={response.score === null ? "Not scored" : `Score: ${response.score} out of 10`}>{response.score === null ? "—" : `${response.score}/10`}</strong></button></li>)}</ol></nav>
        {currentResponse && <section className="interviewAnswerPanel" aria-labelledby="review-question-title">
          <header><span className="sectionLabel">Question {activeIndex + 1} of {attempt.responses.length}</span><h2 id="review-question-title">{currentResponse.questionTitle}</h2>{currentResponse.questionDescription && <p>{currentResponse.questionDescription}</p>}</header>
          <div className="interviewAnswer"><h3>Candidate answer</h3>
            {currentResponse.type === "SHORT_ANSWER" && <p className="submittedText">{String((currentResponse.item as { textValue?: string }).textValue ?? "") || "No text submitted."}</p>}
            {currentResponse.type === "VIDEO" && (videoUrl ? <video className="mediaFrame interviewResponseVideo" controls playsInline src={videoUrl} /> : <div className="mediaEmpty">Playable video is unavailable.</div>)}
            {currentResponse.type === "MULTIPLE_CHOICE" && <ul className="reviewOptionList">{((currentResponse.item as { options?: Array<{ id: string; label: string; value: string; isCorrect: boolean }> }).options ?? []).map((option) => {
              const selected = selectedOptionIds.has(option.id);
              return <li key={option.id} className={`${selected ? "candidateSelected" : ""} ${option.isCorrect ? "correctAnswer" : ""}`}><span aria-hidden="true">{option.isCorrect ? "✓" : selected ? "●" : "○"}</span><span><strong>{option.label}</strong>{option.value !== option.label && <small>{option.value}</small>}</span><span className="optionLabels">{selected && <em>Candidate selected</em>}{option.isCorrect && <em>Correct answer</em>}</span></li>;
            })}</ul>}
          </div>
          {(currentResponse.type === "SHORT_ANSWER" || currentResponse.type === "VIDEO") && <section className="interviewFeedback" aria-labelledby="feedback-title"><h3 id="feedback-title">Evaluator feedback</h3><div className="feedbackFields"><fieldset className="scorePicker"><legend>Score (1–10)</legend><div>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} type="button" className={score === String(value) ? "selected" : ""} aria-pressed={score === String(value)} onClick={() => setScore(String(value))}>{value}</button>)}</div></fieldset><label><span>Comment</span><textarea rows={4} maxLength={5000} value={comment} onChange={(event) => setComment(event.target.value)} /></label></div><div className="feedbackActions"><Button loading={saving} onClick={() => void saveFeedback()}>Save feedback</Button>{saveMessage && <span role="status">{saveMessage}</span>}</div></section>}
        </section>}
      </div>
      <nav className="candidateReviewNavigation" aria-label="Candidate navigation"><div>{previousId && <ButtonLink variant="secondary" href={`/positions/${encodeURIComponent(positionId)}/interview/${encodeURIComponent(previousId)}?status=${slug(navigationStatus ?? interview.workflowStatus)}`}>← Previous candidate</ButtonLink>}</div><span>{navigationIndex >= 0 ? `${navigationIndex + 1} of ${navigationIds.length}` : "Current candidate"}</span><div>{nextId && <ButtonLink variant="secondary" href={`/positions/${encodeURIComponent(positionId)}/interview/${encodeURIComponent(nextId)}?status=${slug(navigationStatus ?? interview.workflowStatus)}`}>Next candidate →</ButtonLink>}</div></nav>
    </>}
  </div>;
}
