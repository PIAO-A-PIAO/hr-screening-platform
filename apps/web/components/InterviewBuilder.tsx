"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, browserApiUrl } from "../lib/api";
import { Job, QuestionType } from "../lib/types";

const labels: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTI_SELECT: "Multiple choice",
  TEXT: "Long text",
  FILL_BLANK: "Fill in the blank",
  VIDEO: "Video answer",
};

export function InterviewBuilder({ job }: { job: Job }) {
  const router = useRouter();
  const [type, setType] = useState<QuestionType>("VIDEO");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choiceQuestion = type === "SINGLE_CHOICE" || type === "MULTI_SELECT";

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let mediaUrl = String(form.get("promptMediaUrl") || "");
    let mediaType = String(form.get("promptMediaType") || "IMAGE");
    try {
      const promptFile = form.get("promptMediaFile");
      if (promptFile instanceof File && promptFile.size > 0) {
        const upload = new FormData();
        upload.append("file", promptFile);
        const response = await fetch(`${browserApiUrl}/media/upload`, { method: "POST", body: upload });
        if (!response.ok) throw new Error("Prompt media upload failed");
        const uploaded = await response.json() as { url: string; contentType: string };
        mediaUrl = uploaded.url;
        mediaType = uploaded.contentType.startsWith("video/") ? "VIDEO" : "IMAGE";
      }
      await api(`/jobs/${job.id}/interview/questions`, {
        method: "POST",
        body: JSON.stringify({
          type,
          prompt: form.get("prompt"),
          helpText: form.get("helpText") || undefined,
          promptMediaUrl: mediaUrl || undefined,
          promptMediaType: mediaUrl ? mediaType : undefined,
          options: choiceQuestion ? String(form.get("options") || "").split("\n").map((item) => item.trim()).filter(Boolean) : undefined,
          weight: Number(form.get("weight")),
          required: form.get("required") === "on",
          preparationSeconds: type === "VIDEO" ? Number(form.get("preparationSeconds")) : undefined,
          answerSeconds: type === "VIDEO" ? Number(form.get("answerSeconds")) : undefined,
          maxRetries: type === "VIDEO" ? Number(form.get("maxRetries")) : 0,
        }),
      });
      formElement.reset();
      setType("VIDEO");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add question"); }
    finally { setBusy(false); }
  }

  async function remove(questionId: string) {
    if (!window.confirm("Remove this question?")) return;
    await api(`/jobs/${job.id}/interview/questions/${questionId}`, { method: "DELETE" });
    router.refresh();
  }

  async function publish() {
    setBusy(true); setError("");
    try { await api(`/jobs/${job.id}/interview/publish`, { method: "POST" }); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not publish interview"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(340px, .9fr)", alignItems: "start" }}>
      <section className="grid">
        {(job.template?.questions ?? []).map((question, index) => (
          <article className="card questionCard" key={question.id}>
            <span className="questionNo">{index + 1}</span>
            <div>
              <h4>{question.prompt}</h4>
              <p><span className="questionType">{labels[question.type]}</span> · Weight {question.weight} · {question.required ? "Required" : "Optional"}</p>
              {question.options && <p style={{ marginTop: 7 }}>Options: {question.options.join(" · ")}</p>}
              {question.promptMediaUrl && (
                <div className="mediaPrompt">
                  {question.promptMediaType === "VIDEO" ? <video src={question.promptMediaUrl} controls /> : <img src={question.promptMediaUrl} alt="Question prompt" />}
                </div>
              )}
            </div>
            <button className="button danger" type="button" onClick={() => remove(question.id)}>Remove</button>
          </article>
        ))}
        {!job.template?.questions.length && <div className="card empty">Add the first question using the form.</div>}
      </section>

      <aside className="card">
        <h3 style={{ marginTop: 0 }}>Add a question</h3>
        <form className="formGrid" onSubmit={add}>
          <div className="field"><label>Answer type</label><select name="type" value={type} onChange={(event) => setType(event.target.value as QuestionType)}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
          <div className="field"><label>Question</label><textarea name="prompt" placeholder="Tell us about a difficult technical decision…" required /></div>
          <div className="field"><label>Helper text (optional)</label><input name="helpText" placeholder="Keep your answer under two minutes." /></div>
          {choiceQuestion && <div className="field"><label>Options — one per line</label><textarea name="options" placeholder={"Option A\nOption B\nOption C"} required /></div>}
          <div className="split">
            <div className="field"><label>Prompt media URL</label><input name="promptMediaUrl" type="url" placeholder="https://…/diagram.png" /></div>
            <div className="field"><label>Media type</label><select name="promptMediaType"><option value="IMAGE">Image</option><option value="VIDEO">Video</option></select></div>
          </div>
          <div className="field"><label>Or upload prompt media</label><input name="promptMediaFile" type="file" accept="image/*,video/*" /></div>
          <div className="field"><label>Weight</label><input name="weight" type="number" min="0.1" max="100" step="0.1" defaultValue="1" required /></div>
          {type === "VIDEO" && (
            <div className="split">
              <div className="field"><label>Preparation seconds</label><input name="preparationSeconds" type="number" min="0" defaultValue="30" required /></div>
              <div className="field"><label>Answer seconds</label><input name="answerSeconds" type="number" min="5" defaultValue="120" required /></div>
              <div className="field"><label>Retries</label><input name="maxRetries" type="number" min="0" max="10" defaultValue="1" required /></div>
            </div>
          )}
          <label className="option"><input name="required" type="checkbox" defaultChecked /> Required question</label>
          {error && <div className="error">{error}</div>}
          <button className="button secondary" disabled={busy}>Add question</button>
        </form>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0" }} />
        <button className="button" style={{ width: "100%" }} disabled={busy || !job.template?.questions.length} onClick={publish}>{job.template?.isPublished ? "Publish latest changes" : "Publish interview"}</button>
      </aside>
    </div>
  );
}
