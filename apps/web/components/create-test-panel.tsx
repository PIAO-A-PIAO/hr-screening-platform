"use client";

import { useEffect, useRef, useState } from "react";
import { PositionQuestionEditor, type PositionQuestionEditorHandle } from "./position-question-editor";
import { AppIcon } from "./ui/app-icon";
import { createTest, getTest, removeTestClosingVideo, testClosingVideoUrl, updateTest, uploadQuestionVideo, uploadTestClosingVideo, type CreateTestInput, type QuestionDraftInput, type TestResponse, type TestStatus } from "../lib/question-api";
import type { PositionResponse } from "../lib/position-api";

type Entry = { clientId: string; draft: QuestionDraftInput };
type Props = { position: PositionResponse; className?: string; onSaved?: () => void };
const clientId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const entriesFromTest = (test: TestResponse): Entry[] => test.questions.map((question) => {
  const item = question.item as {
    options?: Array<{ label: string; value: string; order: number; isCorrect: boolean }>;
    maxLength?: number | null;
  };
  return { clientId: question.id, draft: {
    questionId: question.id, order: question.order, title: question.title, description: question.description ?? undefined,
    type: question.type,
    item: question.type === "VIDEO" ? { type: "VIDEO" }
      : question.type === "SHORT_ANSWER" ? { type: "SHORT_ANSWER", maxLength: item.maxLength ?? undefined }
      : { type: "MULTIPLE_CHOICE", allowMultipleSelection: false, shuffleOptions: false,
          options: (item.options ?? []).slice(0, 4).map((option, index) => ({
            label: option.label, value: `option_${index + 1}`, order: index,
            isCorrect: index === Math.max(0, (item.options ?? []).slice(0, 4).findIndex((entry) => entry.isCorrect)),
          })) },
  } };
});

export function CreateTestPanel({ position, className, onSaved }: Props) {
  const [testId, setTestId] = useState<string | null>(position.test?.id ?? null);
  const [test, setTest] = useState<TestResponse | null>(null);
  const [name, setName] = useState(position.test?.name ?? position.title);
  const [description, setDescription] = useState(position.test?.description ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<TestStatus>(position.test?.status ?? "DRAFT");
  const [closingTitle, setClosingTitle] = useState("Thank you!");
  const [closingMessage, setClosingMessage] = useState("Thank you for completing the interview. We will be in touch soon.");
  const [closingFile, setClosingFile] = useState<File | null>(null);
  const [closingBusy, setClosingBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingClosing, setEditingClosing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(position.test));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const editor = useRef<PositionQuestionEditorHandle>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const id = position.test?.id;
    setTestId(id ?? null); setName(position.test?.name ?? position.title);
    setDescription(position.test?.description ?? ""); setStatus(position.test?.status ?? "DRAFT");
    setEstimatedMinutes("");
    setTest(null); setEntries([]); entriesRef.current = []; setSelectedId(null); setEditingClosing(false); setError(null); setNotice(""); setClosingFile(null);
    if (!id) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    void getTest(id).then((loaded) => { if (!active) return;
      const next = entriesFromTest(loaded);
      setTest(loaded); setName(loaded.name); setDescription(loaded.description ?? "");
      setEstimatedMinutes(loaded.estimatedDurationMinutes == null ? "" : String(loaded.estimatedDurationMinutes));
      setClosingTitle(loaded.closing?.title ?? "Thank you!");
      setClosingMessage(loaded.closing?.message ?? "Thank you for completing the interview. We will be in touch soon.");
      setTags(loaded.tags.join(", ")); setStatus(loaded.status); setEntries(next); entriesRef.current = next;
      setSelectedId(next[0]?.clientId ?? null);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Failed to load test"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [position.id, position.title, position.test?.id, position.test?.name, position.test?.description, position.test?.status]);

  useEffect(() => {
    if (!testId || !test?.questions.some((question) => ["PENDING", "PROCESSING"].includes(
      String((question.item as { processing?: string }).processing ?? ""),
    ))) return;
    const timer = setInterval(() => {
      void getTest(testId).then(setTest).catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [testId, test]);

  const selected = entries.find((entry) => entry.clientId === selectedId) ?? null;
  const payload = (next: Entry[]): CreateTestInput => ({
    name: name.trim(), description: description.trim() || undefined,
    estimatedDurationMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
    tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), status,
    positionId: position.id, questions: next.map((entry, index) => ({ ...entry.draft, order: index + 1 })),
    closing: { title: closingTitle.trim() || "Thank you!", message: closingMessage.trim() },
  });

  async function persist(next: Entry[], preferredId: string | null, media?: { order: number; file: File | null }) {
    if (!name.trim()) throw new Error("Enter a test title before saving a question.");
    setSaving(true); setError(null); setNotice("");
    try {
      const saved = testId ? await updateTest(testId, payload(next)) : await createTest(payload(next));
      setTestId(saved.id);
      if (media?.file) {
        const savedQuestion = saved.questions.find((question) => question.order === media.order);
        if (!savedQuestion) throw new Error("Saved question was not found for video upload.");
        await uploadQuestionVideo(savedQuestion.id, media.file);
      }
      const refreshed = media?.file ? await getTest(saved.id) : saved;
      const normalized = entriesFromTest(refreshed);
      setTest(refreshed); setEntries(normalized); entriesRef.current = normalized;
      const preferredOrder = next.findIndex((entry) => entry.clientId === preferredId);
      setSelectedId(preferredId === null ? null : normalized[preferredOrder]?.clientId ?? null);
      setNotice("Saved."); onSaved?.();
      return refreshed;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save test";
      setError(message);
      throw caught;
    } finally { setSaving(false); }
  }

  async function saveQuestion(question: QuestionDraftInput, media: { videoFile: File | null }, startNew: boolean) {
    const id = selected?.clientId ?? clientId();
    const index = selected ? entries.findIndex((entry) => entry.clientId === id) : entries.length;
    const next = [...entries];
    next[index] = { clientId: id, draft: { ...question, order: index + 1 } };
    await persist(next, startNew ? null : id, { order: index + 1, file: media.videoFile });
  }

  async function addNew() {
    if (saving) return;
    if (editingClosing) { setEditingClosing(false); setSelectedId(null); return; }
    const saved = await editor.current?.saveAndStartNew();
    if (saved) setSelectedId(null);
  }
  async function selectQuestion(id: string) {
    if ((id === selectedId && !editingClosing) || saving) return;
    if (editingClosing) { setEditingClosing(false); setSelectedId(id); return; }
    const saved = await editor.current?.saveAndStartNew();
    if (saved) setSelectedId(id);
  }
  async function selectClosing() {
    if (editingClosing || saving) return;
    const saved = await editor.current?.saveAndStartNew();
    if (saved === false) return;
    setSelectedId(null);
    setEditingClosing(true);
  }
  async function moveQuestion(index: number, target: number) {
    if (target < 0 || target >= entries.length || target === index || saving) return;
    const next = [...entries];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    try { await persist(next, selectedId); } catch { /* Error is displayed without changing the order. */ }
  }
  async function reorder(index: number, direction: -1 | 1) { await moveQuestion(index, index + direction); }
  async function remove(index: number) {
    if (saving) return;
    const next = entries.filter((_, at) => at !== index);
    const nextSelection = selectedId === entries[index].clientId ? next[Math.min(index, next.length - 1)]?.clientId ?? null : selectedId;
    try { await persist(next, nextSelection); } catch { /* Keep the current list. */ }
  }
  async function saveMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editorSaved = await editor.current?.saveAndStartNew();
    if (editorSaved === false) return;
    try { await persist(entriesRef.current, null); } catch { /* Error is displayed. */ }
  }

  async function saveClosing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closingBusy || saving) return;
    setClosingBusy(true);
    try {
      const editorSaved = await editor.current?.saveAndStartNew();
      if (editorSaved === false) return;
      const saved = await persist(entriesRef.current, null);
      if (closingFile) {
        const uploaded = await uploadTestClosingVideo(saved.id, closingFile);
        setTest(uploaded); setClosingFile(null);
      }
      setNotice("Closing screen saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Closing screen could not be saved"); }
    finally { setClosingBusy(false); }
  }

  async function removeClosing() {
    if (!testId || closingBusy) return;
    setClosingBusy(true); setError(null);
    try { setTest(await removeTestClosingVideo(testId)); setClosingFile(null); setNotice("Closing video removed."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Closing video could not be removed"); }
    finally { setClosingBusy(false); }
  }

  return <section className={`testBuilderPage ${className ?? ""}`}>
    <header className="testBuilderHero"><div><span className="sectionLabel">Test builder</span><h1>{position.title}</h1><p>Build the candidate experience, then finish with a closing message.</p></div><div className="testBuilderHeroStats"><strong>{entries.length}</strong><span>{entries.length === 1 ? "question" : "questions"}</span><span className="testBuilderStatus">{status.toLowerCase()}</span>{notice && <span className="testBuilderNotice" role="status">{notice}</span>}</div></header>
      {loading ? <div className="stateCard">Loading test...</div> : <>
        {error && <div className="stateCard errorState" role="alert">{error}</div>}
        <details className="testBuilderSettings"><summary><span><strong>Test settings</strong><small>{name || position.title} · {status.toLowerCase()}{tags.trim() ? ` · ${tags}` : ""}</small></span><span className="testBuilderDisclosure"><span className="testBuilderExpandLabel">Expand</span><span className="testBuilderCollapseLabel">Collapse</span><span className="testBuilderChevron" aria-hidden="true">⌄</span></span></summary><form className="formGrid" onSubmit={(event) => void saveMetadata(event)}>
          <label className="field"><span>Test title</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field fieldWide"><span>Description</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="field"><span>Estimated total time (minutes)</span><input type="number" min={1} max={480} step={1} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} /><small>Shown to candidates before they start. Leave blank to use a question-based estimate.</small></label>
          <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as TestStatus)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
          <label className="field"><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
          <div className="fieldWide actionsRow"><button className="primaryButton" type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button></div>
        </form></details>
        <div className="testBuilderGrid">
          {editingClosing ? <section className="panel testBuilderClosingEditor" aria-label="Thank-you screen editor">
            <div className="panelHeader"><div><span className="sectionLabel">After the final answer</span><h2>Thank-you screen</h2><p>The candidate sees this after submitting. This screen is not scored.</p></div></div>
            <form onSubmit={(event) => void saveClosing(event)}>
              <div className="testBuilderClosingFields">
                <label className="field"><span>Heading</span><input maxLength={120} value={closingTitle} onChange={(event) => setClosingTitle(event.target.value)} /></label>
                <label className="field"><span>Message</span><textarea rows={3} maxLength={1000} value={closingMessage} onChange={(event) => setClosingMessage(event.target.value)} /></label>
                <label className="field"><span>Optional thank-you video</span><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={(event) => setClosingFile(event.target.files?.[0] ?? null)} /><small>MP4, WebM, MOV, or AVI · up to 100 MB</small></label>
                {test?.closing?.videoAvailable && testId && <div className="testBuilderClosingVideo"><video controls playsInline src={testClosingVideoUrl(testId)} /><button className="ghostButton compactButton" type="button" disabled={closingBusy} onClick={() => void removeClosing()}>Remove video</button></div>}
              </div>
              <div className="testBuilderClosingFooter"><span>Final step of the interview</span><button className="primaryButton" type="submit" disabled={saving || closingBusy}>{saving || closingBusy ? "Saving..." : "Save closing screen"}</button></div>
            </form>
          </section> : <PositionQuestionEditor ref={editor} question={selected?.draft ?? null} order={selected?.draft.order ?? entries.length + 1} saving={saving} videoAvailable={Boolean((test?.questions.find((question) => question.id === selected?.draft.questionId)?.item as { video?: unknown } | undefined)?.video)} thumbnailAvailable={Boolean((test?.questions.find((question) => question.id === selected?.draft.questionId)?.item as { thumbnail?: unknown } | undefined)?.thumbnail)} onSave={saveQuestion} />}
          <aside className="draftSidebar" aria-label="Interview flow"><div className="testBuilderOutlineHeader"><div><span className="sectionLabel">Interview flow</span><h2>Questions</h2></div><span>{entries.length}</span></div>
            <ol className="draftOrderList">{entries.map((entry, index) => {
              const video = test?.questions.find((question) => question.id === entry.draft.questionId);
              const videoItem = video?.item as { processing?: string; thumbnail?: { assetId?: string; id?: string } } | undefined;
              return <li className={`draftCard ${!editingClosing && selectedId === entry.clientId ? "selected" : ""} ${dragOverIndex === index && draggedIndex !== index ? "dragOver" : ""}`} key={entry.clientId} onDragOver={(event) => { if (draggedIndex === null) return; event.preventDefault(); setDragOverIndex(index); }} onDrop={(event) => { event.preventDefault(); if (draggedIndex !== null) void moveQuestion(draggedIndex, index); setDraggedIndex(null); setDragOverIndex(null); }}>
                <button type="button" className="draftSelect" onClick={() => void selectQuestion(entry.clientId)} disabled={saving} aria-current={!editingClosing && selectedId === entry.clientId ? "step" : undefined}>
                  <span className="draftNumber">{index + 1}</span>
                  <span className="draftIdentity"><strong>{entry.draft.title}</strong><small>{entry.draft.type.replaceAll("_", " ").toLowerCase()}{entry.draft.type === "VIDEO" ? ` · ${String(videoItem?.processing ?? "no video").toLowerCase()}` : ""}</small></span>
                </button>
                <div className="draftActions"><button type="button" className="draftDrag" draggable={!saving} disabled={saving} aria-label={`Drag ${entry.draft.title} to reorder`} title="Drag to reorder" onDragStart={(event) => { setDraggedIndex(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }} onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}><AppIcon name="drag" size={17} /></button><span className="draftActionsSpacer" /><button type="button" disabled={saving || index === 0} aria-label={`Move ${entry.draft.title} up`} title="Move up" onClick={() => void reorder(index, -1)}><AppIcon name="moveUp" size={17} /></button><button type="button" disabled={saving || index === entries.length - 1} aria-label={`Move ${entry.draft.title} down`} title="Move down" onClick={() => void reorder(index, 1)}><AppIcon name="moveDown" size={17} /></button><button type="button" className="draftRemove" disabled={saving} aria-label={`Delete ${entry.draft.title}`} title="Delete question" onClick={() => void remove(index)}><AppIcon name="delete" size={17} /></button></div>
              </li>;
            })}</ol>
            <button type="button" className="testBuilderAdd" disabled={saving} onClick={() => void addNew()}><span aria-hidden="true">＋</span> Add question</button>
            <button type="button" className={`testBuilderOutlineEnd ${editingClosing ? "selected" : ""}`} onClick={() => void selectClosing()} disabled={saving} aria-current={editingClosing ? "step" : undefined}><span aria-hidden="true">✓</span><span><strong>Thank-you screen</strong><small>{closingTitle || "Thank you!"} · {test?.closing?.videoAvailable ? "Video added" : "No video"}</small></span><span className="testBuilderOutlineArrow" aria-hidden="true">›</span></button>
          </aside>
        </div>
      </>}
  </section>;
}
