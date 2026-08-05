"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { Answer, Application } from "../lib/types";

const ratingValues = Array.from({ length: 11 }, (_, index) => index / 2);

export function ReviewWorkspace({ application }: { application: Application }) {
  const answers = application.answers ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(application.currentReview?.ratings.map((rating) => [rating.answerId, rating.rating]) ?? []));
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(application.currentReview?.ratings.map((rating) => [rating.answerId, rating.note ?? ""]) ?? []));
  const [transcripts, setTranscripts] = useState<Record<string, string>>(() => Object.fromEntries(answers.map((answer) => [answer.id, answer.transcript ?? ""])));
  const [overallNotes, setOverallNotes] = useState(application.currentReview?.overallNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const active = answers[activeIndex];

  const localScore = useMemo(() => {
    const rated = answers.filter((answer) => ratings[answer.id] !== undefined);
    const weights = rated.reduce((sum, answer) => sum + answer.question.weight, 0);
    if (!weights) return null;
    return rated.reduce((sum, answer) => sum + ratings[answer.id] * answer.question.weight, 0) / weights;
  }, [answers, ratings]);

  async function save() {
    setStatus("saving");
    try {
      await api(`/applications/${application.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          overallNotes,
          ratings: answers.filter((answer) => ratings[answer.id] !== undefined).map((answer) => ({
            answerId: answer.id,
            questionId: answer.questionId,
            rating: ratings[answer.id],
            note: notes[answer.id] ?? "",
            transcript: transcripts[answer.id] ?? "",
          })),
        }),
      });
      setStatus("saved");
    } catch { setStatus("error"); }
  }

  if (!active) return <div className="card empty">This candidate has no submitted answers.</div>;
  const reviewerAverage = (answer: Answer) => {
    if (!answer.ratings?.length) return null;
    return answer.ratings.reduce((sum, rating) => sum + rating.rating, 0) / answer.ratings.length;
  };

  return (
    <>
      <div className="reviewHeader">
        <div><Link href={`/jobs/${application.job?.id}`} className="metaRow">← Back to job</Link><h1>{application.candidate.firstName} {application.candidate.lastName} · {application.job?.title}</h1></div>
        <div className="formActions"><span className="score">{localScore == null ? "Not rated" : `${localScore.toFixed(2)}/5`}</span><button className="button" onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : status === "saved" ? "Review saved ✓" : "Submit review"}</button></div>
      </div>
      {status === "error" && <div className="error" style={{ marginBottom: 10 }}>Review could not be saved. Check the API and try again.</div>}
      <div className="reviewLayout">
        <aside className="reviewNav">
          <h3>Answers</h3>
          {answers.map((answer, index) => (
            <button key={answer.id} className={`answerTab ${index === activeIndex ? "active" : ""}`} onClick={() => setActiveIndex(index)}>
              <strong>Q{index + 1}</strong> · {answer.question.type.replaceAll("_", " ").toLowerCase()}<br />
              <small>Weight {answer.question.weight} · {ratings[answer.id] === undefined ? "Not rated" : `${ratings[answer.id]}/5`}</small>
            </button>
          ))}
          <div className="field" style={{ marginTop: 22 }}><label>Overall notes</label><textarea value={overallNotes} onChange={(event) => setOverallNotes(event.target.value)} /></div>
        </aside>

        <section className="reviewMain">
          <div className="metaRow"><span>Question {activeIndex + 1} of {answers.length}</span><span>Weight {active.question.weight}</span>{reviewerAverage(active) != null && <span>Team avg {reviewerAverage(active)?.toFixed(1)}/5</span>}</div>
          <h2>{active.question.prompt}</h2>
          {active.question.promptMediaUrl && <div className="mediaPrompt">{active.question.promptMediaType === "VIDEO" ? <video src={active.question.promptMediaUrl} controls /> : <img src={active.question.promptMediaUrl} alt="Question reference" />}</div>}
          <h4>Candidate answer</h4>
          {active.mediaUrl ? <video src={active.mediaUrl} controls /> : active.jsonValue ? <div className="textAnswer">{active.jsonValue.join(", ")}</div> : <div className="textAnswer">{active.textValue || "No answer"}</div>}
          {active.ratings?.length ? <div style={{ marginTop: 18 }}><h4>Other reviewer votes</h4>{active.ratings.map((rating, index) => <p className="metaRow" key={index}><strong>{rating.review.reviewer.name}</strong><span>{rating.rating}/5</span><span>{rating.note || "No note"}</span></p>)}</div> : null}
        </section>

        <aside className="transcriptPanel">
          <h3>Rough transcript</h3>
          <p className="metaRow">Editable until this review is submitted.</p>
          <textarea value={transcripts[active.id] ?? ""} onChange={(event) => setTranscripts((current) => ({ ...current, [active.id]: event.target.value }))} placeholder={active.mediaUrl ? "Automated transcription will appear here…" : "Not applicable for this answer."} />
          <h3>Your rating</h3>
          <div className="ratingButtons">{ratingValues.map((value) => <button type="button" key={value} className={ratings[active.id] === value ? "selected" : ""} onClick={() => setRatings((current) => ({ ...current, [active.id]: value }))}>{value}</button>)}</div>
          <div className="field"><label>Note for this answer</label><textarea style={{ minHeight: 110 }} value={notes[active.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [active.id]: event.target.value }))} placeholder="Evidence, concerns, or follow-up…" /></div>
        </aside>
      </div>
    </>
  );
}
