"use client";

import { useState } from "react";
import { api } from "../lib/api";
import { Answer, Application, Question } from "../lib/types";
import { VideoRecorder } from "./VideoRecorder";

function QuestionAnswer({ question, initial, token, onSaved }: { question: Question; initial?: Answer; token: string; onSaved: () => void }) {
  const [textValue, setTextValue] = useState(initial?.textValue ?? "");
  const [selected, setSelected] = useState<string[]>(initial?.jsonValue ?? []);
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const choice = question.type === "SINGLE_CHOICE" || question.type === "MULTI_SELECT";

  function choose(option: string) {
    if (question.type === "SINGLE_CHOICE") setSelected([option]);
    else setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }
  async function save() {
    setState("saving");
    try {
      await api(`/public/interviews/${token}/answers/${question.id}`, {
        method: "PUT",
        body: JSON.stringify({ textValue: textValue || undefined, jsonValue: choice ? selected : undefined, mediaUrl: mediaUrl || undefined }),
      });
      setState("saved"); onSaved();
    } catch { setState("error"); }
  }

  return (
    <article className="card">
      <div className="metaRow"><span>{question.type.replaceAll("_", " ").toLowerCase()}</span><span>Weight {question.weight}</span>{question.required && <span>Required</span>}</div>
      <h3>{question.prompt}</h3>
      {question.helpText && <p className="metaRow">{question.helpText}</p>}
      {question.promptMediaUrl && <div className="mediaPrompt">{question.promptMediaType === "VIDEO" ? <video src={question.promptMediaUrl} controls /> : <img src={question.promptMediaUrl} alt="Question reference" />}</div>}
      <div className="answerArea">
        {choice && question.options?.map((option) => <label className="option" key={option}><input type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} checked={selected.includes(option)} onChange={() => choose(option)} /> {option}</label>)}
        {(question.type === "TEXT" || question.type === "FILL_BLANK") && <div className="field"><textarea value={textValue} onChange={(event) => setTextValue(event.target.value)} placeholder="Type your answer…" /></div>}
        {question.type === "VIDEO" && <VideoRecorder answerSeconds={question.answerSeconds ?? 120} preparationSeconds={question.preparationSeconds ?? 30} maxRetries={question.maxRetries} onUploaded={setMediaUrl} />}
      </div>
      <div className="formActions" style={{ marginTop: 14 }}><button type="button" className="button secondary" disabled={state === "saving" || (question.type === "VIDEO" && !mediaUrl)} onClick={save}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save answer"}</button>{state === "error" && <span className="error">Could not save. Try again.</span>}</div>
    </article>
  );
}

export function CandidateInterview({ application, token }: { application: Application; token: string }) {
  const [saved, setSaved] = useState(new Set(application.answers?.map((answer) => answer.questionId) ?? []));
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(application.submittedAt));
  const questions = application.job?.template?.questions ?? [];
  async function submit() {
    setError("");
    try { await api(`/public/interviews/${token}/submit`, { method: "POST" }); setSubmitted(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit interview"); }
  }
  if (submitted) return <div className="interviewShell"><div className="interviewIntro"><h1>Interview submitted</h1><p>Thank you, {application.candidate.firstName}. Your answers are now with the hiring team.</p></div></div>;
  return (
    <div className="interviewShell">
      <div className="interviewIntro"><div className="brand"><span className="brandMark">I</span> Interview Desk</div><h1>{application.job?.title}</h1><p>{application.job?.template?.welcomeText}</p><div className="metaRow"><span>{questions.length} questions</span><span>{saved.size} saved</span></div></div>
      <div className="grid">
        {questions.map((question) => <QuestionAnswer key={question.id} question={question} token={token} initial={application.answers?.find((answer) => answer.questionId === question.id)} onSaved={() => setSaved((current) => new Set(current).add(question.id))} />)}
        {error && <div className="error">{error}</div>}
        <button className="button" style={{ minHeight: 52 }} onClick={submit}>Submit complete interview</button>
      </div>
    </div>
  );
}
