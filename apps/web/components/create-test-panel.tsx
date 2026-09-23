"use client";

import { useEffect, useRef, useState } from "react";
import { PositionQuestionEditor, type PositionQuestionEditorHandle } from "./position-question-editor";
import { createTest, getTest, updateTest, uploadQuestionVideo, type CreateTestInput, type QuestionDraftInput, type TestResponse, type TestStatus } from "../lib/question-api";
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
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<TestStatus>(position.test?.status ?? "DRAFT");
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(position.test));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const editor = useRef<PositionQuestionEditorHandle>(null);

  useEffect(() => {
    const id = position.test?.id;
    setTestId(id ?? null); setName(position.test?.name ?? position.title);
    setDescription(position.test?.description ?? ""); setStatus(position.test?.status ?? "DRAFT");
    setTest(null); setEntries([]); entriesRef.current = []; setSelectedId(null); setError(null); setNotice("");
    if (!id) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    void getTest(id).then((loaded) => { if (!active) return;
      const next = entriesFromTest(loaded);
      setTest(loaded); setName(loaded.name); setDescription(loaded.description ?? "");
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
    tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), status,
    positionId: position.id, questions: next.map((entry, index) => ({ ...entry.draft, order: index + 1 })),
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
    const saved = await editor.current?.saveAndStartNew();
    if (saved) setSelectedId(null);
  }
  async function selectQuestion(id: string) {
    if (id === selectedId || saving) return;
    const saved = await editor.current?.saveAndStartNew();
    if (saved) setSelectedId(id);
  }
  async function reorder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length || saving) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    try { await persist(next, selectedId); } catch { /* Error is displayed without changing the order. */ }
  }
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

  return <section className={`detailCard attachedTestAccordion ${className ?? ""}`}>
    <div className="attachedTestBody">
      <div className="panelHeader"><div><span className="sectionLabel">Test builder</span><h2>{position.title}</h2></div><span className="pill">{entries.length} questions</span></div>
      {loading ? <div className="stateCard">Loading test...</div> : <>
        {error && <div className="stateCard errorState" role="alert">{error}</div>}
        <form className="formGrid" onSubmit={(event) => void saveMetadata(event)}>
          <label className="field"><span>Test title</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field fieldWide"><span>Description</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as TestStatus)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
          <label className="field"><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
          <div className="fieldWide actionsRow"><button className="primaryButton" type="submit" disabled={saving}>{saving ? "Saving..." : "Save test settings"}</button></div>
        </form>
        <div className="testBuilderGrid">
          <PositionQuestionEditor ref={editor} question={selected?.draft ?? null} order={selected?.draft.order ?? entries.length + 1} saving={saving} onSave={saveQuestion} />
          <aside className="detailCard draftSidebar"><strong>Question order</strong>
            <ul className="dataList draftOrderList">{entries.map((entry, index) => <li className={`draftCard ${selectedId === entry.clientId ? "selected" : ""}`} key={entry.clientId}>
              <button type="button" className="ghostButton" onClick={() => void selectQuestion(entry.clientId)} disabled={saving}><strong>{index + 1}. {entry.draft.title}</strong><span> · {entry.draft.type.replaceAll("_", " ")}</span></button>
              {entry.draft.type === "VIDEO" && <small>Video: {String((test?.questions.find((question) => question.id === entry.draft.questionId)?.item as { processing?: string } | undefined)?.processing ?? "No upload")}</small>}
              <div className="draftActions"><button type="button" className="ghostButton compactButton" disabled={saving || index === 0} onClick={() => void reorder(index, -1)}>Move Up</button><button type="button" className="ghostButton compactButton" disabled={saving || index === entries.length - 1} onClick={() => void reorder(index, 1)}>Move Down</button><button type="button" className="ghostButton compactButton" disabled={saving} onClick={() => void remove(index)}>Remove</button></div>
            </li>)}</ul>
            <button type="button" className="primaryButton" disabled={saving} onClick={() => void addNew()}>Add New Question</button>
          </aside>
        </div>
        {notice && <div className="stateCard successState" role="status">{notice}</div>}
      </>}
    </div>
  </section>;
}
