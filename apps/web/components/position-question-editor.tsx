"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { QuestionDraftInput } from "../lib/question-api";

type EditorMedia = { videoFile: File | null };
export type PositionQuestionEditorHandle = { saveAndStartNew: () => Promise<boolean> };
type Props = {
  question: QuestionDraftInput | null;
  order: number;
  saving: boolean;
  onSave: (question: QuestionDraftInput, media: EditorMedia, startNew: boolean) => Promise<void>;
};
type EditorState = { title: string; description: string; type: QuestionDraftInput["type"]; options: string[]; correct: number; maxLength: string };
const blank = (): EditorState => ({ title: "", description: "", type: "VIDEO", options: ["", "", "", ""], correct: 0, maxLength: "" });
function fromQuestion(question: QuestionDraftInput | null): EditorState {
  if (!question) return blank();
  const item = question.item as { options?: Array<{ label: string; isCorrect: boolean }>; maxLength?: number };
  return {
    title: question.title, description: question.description ?? "", type: question.type,
    options: Array.from({ length: 4 }, (_, index) => item.options?.[index]?.label ?? ""),
    correct: Math.max(0, item.options?.findIndex((option) => option.isCorrect) ?? 0),
    maxLength: item.maxLength == null ? "" : String(item.maxLength),
  };
}

export const PositionQuestionEditor = forwardRef<PositionQuestionEditorHandle, Props>(function PositionQuestionEditor({ question, order, saving, onSave }, ref) {
  const [state, setState] = useState<EditorState>(() => fromQuestion(question));
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setState(fromQuestion(question)); setVideoFile(null); setError(null); }, [question]);

  async function save(startNew: boolean): Promise<boolean> {
    if (busy || saving) return false;
    if (startNew && !question && !state.title.trim() && !state.description.trim() && !videoFile) return true;
    if (!formRef.current?.reportValidity()) return false;
    if (state.type === "MULTIPLE_CHOICE" && state.options.some((option) => !option.trim())) {
      setError("Enter all four options."); return false;
    }
    const item = state.type === "VIDEO" ? { type: "VIDEO" }
      : state.type === "SHORT_ANSWER" ? { type: "SHORT_ANSWER", maxLength: state.maxLength ? Number(state.maxLength) : undefined }
      : { type: "MULTIPLE_CHOICE", allowMultipleSelection: false, shuffleOptions: false,
          options: state.options.map((label, index) => ({ label: label.trim(), value: `option_${index + 1}`, order: index, isCorrect: index === state.correct })) };
    setError(null); setBusy(true);
    try {
      await onSave({ questionId: question?.questionId, order: question?.order ?? order, title: state.title.trim(),
        description: state.description.trim() || undefined, type: state.type, item }, { videoFile }, startNew);
      if (startNew) { setState(blank()); setVideoFile(null); formRef.current?.reset(); }
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Question could not be saved");
      return false;
    } finally { setBusy(false); }
  }
  useImperativeHandle(ref, () => ({ saveAndStartNew: () => save(true) }));

  return <section className="panel"><div className="panelHeader"><div><span className="sectionLabel">Question {order}</span><h2>{question ? "Edit question" : "New question"}</h2></div></div>
    <form ref={formRef} className="formGrid" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
      <label className="field"><span>Title</span><input required value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} /></label>
      <label className="field fieldWide"><span>Description</span><textarea rows={4} value={state.description} onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))} /></label>
      <label className="field"><span>Question type</span><select value={state.type} onChange={(event) => { const type = event.target.value as EditorState["type"]; setState((current) => ({ ...current, type })); if (type !== "VIDEO") setVideoFile(null); }}><option value="VIDEO">Video</option><option value="MULTIPLE_CHOICE">Multiple Choice</option><option value="SHORT_ANSWER">Short Answer</option></select></label>
      {state.type === "VIDEO" && <label className="field fieldWide"><span>Question video</span><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)} /><small>Video processing starts after upload. An existing video remains unless you upload a replacement.</small></label>}
      {state.type === "MULTIPLE_CHOICE" && <fieldset className="fieldWide optionList"><legend>Choose one correct answer</legend>{state.options.map((option, index) => <div className="optionCard" key={index}><label className="field"><span>Option {index + 1}</span><input required value={option} onChange={(event) => setState((current) => ({ ...current, options: current.options.map((value, at) => at === index ? event.target.value : value) }))} /></label><label className="checkRow compact"><input type="radio" name="correct-option" checked={state.correct === index} onChange={() => setState((current) => ({ ...current, correct: index }))} />Correct answer</label></div>)}</fieldset>}
      {state.type === "SHORT_ANSWER" && <label className="field"><span>Maximum answer length</span><input type="number" min={1} step={1} value={state.maxLength} onChange={(event) => setState((current) => ({ ...current, maxLength: event.target.value }))} /></label>}
      {error && <div className="fieldWide stateCard errorState" role="alert">{error}</div>}
      <div className="fieldWide actionsRow"><button className="primaryButton" type="submit" disabled={busy || saving}>{busy || saving ? "Saving..." : "Save question"}</button></div>
    </form>
  </section>;
});
