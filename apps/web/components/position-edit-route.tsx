"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPosition, createPositionDepartment, deletePositionDepartment, deletePositionTag, getPosition, getPositionOptions, updatePosition, type PositionOptionsResponse, type PositionResponse } from "../lib/position-api";
import { getTest, type TestResponse } from "../lib/question-api";
import { PositionEmailSequencePanel } from "./position-email-sequence-panel";
import { AppIcon } from "./ui/app-icon";
import { Modal } from "./ui/modal";
import { TagChip } from "./ui/tag-chip";

type Props = { initialPositionId?: string };
function normalize(value: string) { return value.trim().replace(/\s+/g, " "); }

export function PositionEditRoute({ initialPositionId }: Props) {
  const router = useRouter();
  const [position, setPosition] = useState<PositionResponse | null>(null);
  const [positionId, setPositionId] = useState(initialPositionId ?? null);
  const [options, setOptions] = useState<PositionOptionsResponse>({ tags: [], departments: [] });
  const [title, setTitle] = useState("");
  const [persistedTitle, setPersistedTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialPositionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [test, setTest] = useState<TestResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const tagCardRef = useRef<HTMLElement>(null);
  const departmentCardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getPositionOptions(), initialPositionId ? getPosition(initialPositionId) : Promise.resolve(null)])
      .then(([loadedOptions, loadedPosition]) => {
        if (cancelled) return;
        setOptions(loadedOptions);
        if (loadedPosition) { setPosition(loadedPosition); setTitle(loadedPosition.title); setPersistedTitle(loadedPosition.title); }
      }).catch((caught) => !cancelled && setError(caught instanceof Error ? caught.message : "Failed to load position"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [initialPositionId]);

  useEffect(() => {
    if (!tagOpen && !departmentOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (tagOpen && !tagCardRef.current?.contains(target)) setTagOpen(false);
      if (departmentOpen && !departmentCardRef.current?.contains(target)) setDepartmentOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setTagOpen(false); setDepartmentOpen(false); }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [departmentOpen, tagOpen]);

  const currentQuestion = test?.questions[questionIndex];
  const selectedTags = position?.tags ?? [];
  const selectedDepartmentIds = position?.departments.map((department) => department.id) ?? [];
  const filteredTags = useMemo(() => options.tags.filter((tag) => tag.toLocaleLowerCase().includes(normalize(tagSearch).toLocaleLowerCase())), [options.tags, tagSearch]);
  const normalizedSearch = normalize(tagSearch);
  const canAddTag = normalizedSearch.length > 0 && !options.tags.some((tag) => tag.toLocaleLowerCase() === normalizedSearch.toLocaleLowerCase()) && !selectedTags.some((tag) => tag.toLocaleLowerCase() === normalizedSearch.toLocaleLowerCase());
  const normalizedDepartment = normalize(departmentSearch);
  const filteredDepartments = options.departments.filter((department) => department.name.toLocaleLowerCase().includes(normalizedDepartment.toLocaleLowerCase()));
  const canAddDepartment = normalizedDepartment.length > 0 && !options.departments.some((department) => department.name.toLocaleLowerCase() === normalizedDepartment.toLocaleLowerCase());

  async function saveTitle() {
    const normalized = normalize(title);
    if (!normalized) { setError("Position title is required."); return; }
    setSaving(true); setError(null);
    try {
      const saved = positionId ? await updatePosition(positionId, { title: normalized }) : await createPosition({ title: normalized });
      setPosition(saved); setPositionId(saved.id); setTitle(saved.title); setPersistedTitle(saved.title); setEditingTitle(false);
      if (!initialPositionId) router.replace(`/positions/${encodeURIComponent(saved.id)}/edit`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to save position title"); }
    finally { setSaving(false); }
  }
  async function persistTags(tags: string[]) {
    if (!positionId) return;
    setError(null);
    try { const saved = await updatePosition(positionId, { tags }); setPosition(saved); setOptions((current) => ({ ...current, tags: [...new Set([...current.tags, ...saved.tags])].sort() })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to save tags"); }
  }
  async function persistDepartments(departmentIds: string[]) {
    if (!positionId) return;
    setError(null);
    try { setPosition(await updatePosition(positionId, { departmentIds })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to save departments"); }
  }
  async function addDepartment() {
    if (!positionId || !canAddDepartment || departmentBusy) return;
    setDepartmentBusy(true); setError(null);
    try {
      const department = await createPositionDepartment(normalizedDepartment);
      setOptions((current) => ({ ...current, departments: [...current.departments, department].sort((left, right) => left.name.localeCompare(right.name)) }));
      setPosition(await updatePosition(positionId, { departmentIds: [...selectedDepartmentIds, department.id] }));
      setDepartmentSearch("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to create department"); }
    finally { setDepartmentBusy(false); }
  }
  async function removeDepartmentFromDatabase(department: { id: string; name: string }) {
    if (!window.confirm(`Delete “${department.name}” from all positions and team members?`)) return;
    setDepartmentBusy(true); setError(null);
    try {
      const nextOptions = await deletePositionDepartment(department.id);
      setOptions(nextOptions);
      setPosition((current) => current ? { ...current, departments: current.departments.filter((item) => item.id !== department.id) } : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to delete department"); }
    finally { setDepartmentBusy(false); }
  }
  async function removeTagFromDatabase(tag: string) {
    if (!window.confirm(`Delete “${tag}” from every position?`)) return;
    setError(null);
    try {
      const nextOptions = await deletePositionTag(tag);
      setOptions(nextOptions);
      setPosition((current) => current ? { ...current, tags: current.tags.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase()) } : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to delete tag"); }
  }
  async function openTestPreview() {
    if (!position?.test) return;
    setPreviewOpen(true); setTestLoading(true); setTestError(null); setQuestionIndex(0);
    try { setTest(await getTest(position.test.id)); }
    catch (caught) { setTestError(caught instanceof Error ? caught.message : "Failed to load test questions"); }
    finally { setTestLoading(false); }
  }

  if (loading) return <main className="pageShell positionEditPage"><div className="positionEditSkeleton"><div /><div /><div /></div></main>;
  return <main className="pageShell positionEditPage">
    <div className="positionEditTopbar"><Link className="positionBackLink" href={positionId ? `/positions/${encodeURIComponent(positionId)}` : "/positions"}><span aria-hidden="true">←</span> Back to positions</Link>{position && <span className="positionSaveState"><span className="positionSaveDot" /> Changes save to this position</span>}</div>
    <header className="positionEditHeader"><div><span className="sectionLabel">Position settings</span><h1>{persistedTitle || "Create a position"}</h1><p>Manage the role details, screening test, and candidate communication.</p></div>{position && <span className="positionStatusBadge">{position.status.toLowerCase()}</span>}</header>

    <section className="positionSettingsCard positionTitleCard">
      <div className="positionCardIcon"><AppIcon name="briefcase" size={21} /></div><div className="positionCardCopy"><h2>Position title</h2><p>This name appears throughout the recruiting workspace.</p></div>
      <div className="positionTitleControl"><div className="positionInlineActions">{editingTitle ? <><button className="primaryButton compactButton" type="button" onClick={saveTitle} disabled={saving}>{saving ? "Saving..." : "Save"}</button><button className="ghostButton compactButton" type="button" onClick={() => { setTitle(persistedTitle); setEditingTitle(false); setError(null); }} disabled={saving}>Cancel</button></> : <button className="ghostButton compactButton" type="button" onClick={() => setEditingTitle(true)}>Edit title</button>}</div><input aria-label="Position title" value={title} disabled={!editingTitle || saving} placeholder="Enter a position title" onChange={(event) => setTitle(event.target.value)} /></div>
      {!positionId && <small className="positionUnlockHint">Save the title to create the position and unlock the rest of its settings.</small>}
    </section>
    {error && <div className="stateCard errorState">Error: {error}</div>}

    {position && <>
      <div className="positionSettingsGrid">
        <section className="positionSettingsCard positionChoiceCard" ref={tagCardRef}>
          <div className="positionCardHeader"><div className="positionCardIcon muted"><span>#</span></div><div className="positionCardCopy"><h2>Tags</h2><p>Label and group this position.</p></div><button type="button" className="positionAddButton" aria-expanded={tagOpen} onClick={() => { setTagOpen((open) => !open); setDepartmentOpen(false); }}><AppIcon name="plus" size={16} /> Add</button></div>
          <div className={`positionSelectionWell ${selectedTags.length ? "" : "empty"}`}>{selectedTags.length ? selectedTags.map((tag) => <TagChip key={tag} label={tag} onRemove={() => void persistTags(selectedTags.filter((item) => item !== tag))} />) : <span>No tags added yet</span>}</div>
          {tagOpen && <div className="positionPopover"><label className="positionSearch"><span className="srOnly">Search tags</span><input autoFocus value={tagSearch} placeholder="Search or create a tag..." onChange={(event) => setTagSearch(event.target.value)} /></label>{canAddTag && <button type="button" className="positionCreateOption" onClick={() => { void persistTags([...selectedTags, normalizedSearch]); setTagSearch(""); }}><AppIcon name="plus" size={16} /> Create “{normalizedSearch}”</button>}<div className="positionOptionList">{filteredTags.length ? filteredTags.map((tag) => { const selected = selectedTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase()); return <div className="positionTagOption" key={tag}><button type="button" disabled={selected} onClick={() => void persistTags([...selectedTags, tag])}><span>{tag}</span><small>{selected ? "Selected" : "Add"}</small></button><button type="button" className="positionDeleteTag" aria-label={`Delete ${tag} from all positions`} onClick={() => void removeTagFromDatabase(tag)}>Delete</button></div>; }) : !canAddTag && <small>No tags match.</small>}</div></div>}
        </section>
        <section className="positionSettingsCard positionChoiceCard" ref={departmentCardRef}>
          <div className="positionCardHeader"><div className="positionCardIcon muted"><AppIcon name="people" size={20} /></div><div className="positionCardCopy"><h2>Departments</h2><p>Choose the teams responsible for this role.</p></div><button type="button" className="positionAddButton" aria-expanded={departmentOpen} onClick={() => { setDepartmentOpen((open) => !open); setTagOpen(false); }}><AppIcon name="plus" size={16} /> Add</button></div>
          <div className={`positionSelectionWell ${position.departments.length ? "" : "empty"}`}>{position.departments.length ? position.departments.map((department) => <TagChip key={department.id} label={department.name} onRemove={() => void persistDepartments(selectedDepartmentIds.filter((id) => id !== department.id))} />) : <span>No departments selected</span>}</div>
          {departmentOpen && <div className="positionPopover"><label className="positionSearch"><span className="srOnly">Search departments</span><input autoFocus value={departmentSearch} placeholder="Search or create a department..." onChange={(event) => setDepartmentSearch(event.target.value)} /></label>{canAddDepartment && <button type="button" className="positionCreateOption" disabled={departmentBusy} onClick={() => void addDepartment()}><AppIcon name="plus" size={16} /> Create “{normalizedDepartment}”</button>}<div className="positionOptionList">{filteredDepartments.length ? filteredDepartments.map((department) => { const selected = selectedDepartmentIds.includes(department.id); return <div className="positionTagOption" key={department.id}><button type="button" disabled={selected || departmentBusy} onClick={() => void persistDepartments([...selectedDepartmentIds, department.id])}><span>{department.name}</span><small>{selected ? "Selected" : "Add"}</small></button><button type="button" className="positionDeleteTag" disabled={departmentBusy} aria-label={`Delete ${department.name} from all positions and team members`} onClick={() => void removeDepartmentFromDatabase(department)}>Delete</button></div>; }) : !canAddDepartment && <small>No departments match.</small>}</div></div>}
        </section>
      </div>
      <section className="positionSettingsCard positionTestCard"><div className="positionCardCopy"><h2>Screening test</h2><p>{position.test ? "Review or update the questions candidates will answer." : "Create a screening test for this position."}</p></div><div className="positionTestMeta"><strong>{position.test?.questionCount ?? 0}</strong><span>questions</span></div><div className="positionInlineActions"><button type="button" className="ghostButton compactButton" disabled={!position.test} onClick={() => void openTestPreview()}>Preview</button><Link className="primaryButton compactButton inlineButton" href={`/positions/${encodeURIComponent(position.id)}/edit/${encodeURIComponent(position.test?.id ?? "new")}`}>{position.test ? "Edit test" : "Create test"}</Link></div></section>
      <PositionEmailSequencePanel position={position} onSaved={setPosition} />
    </>}

    <Modal open={previewOpen} title="Test preview" description="Question information only" onClose={() => setPreviewOpen(false)} size="large">
      {testLoading && <div className="stateCard">Loading questions...</div>}{testError && <div className="stateCard errorState">Error: {testError}</div>}{!testLoading && !testError && !currentQuestion && <div className="stateCard emptyStateInline">This test has no questions.</div>}
      {currentQuestion && <div className="questionOnlyPreview"><span className="sectionLabel">Question {questionIndex + 1} of {test?.questions.length}</span><h3>{currentQuestion.title}</h3>{currentQuestion.description && <p>{currentQuestion.description}</p>}<span className="pill">{currentQuestion.type.replaceAll("_", " ")}</span></div>}
      {test && test.questions.length > 0 && <div className="stepperActions"><button className="ghostButton" type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => index - 1)}>Previous</button><button className="primaryButton" type="button" disabled={questionIndex === test.questions.length - 1} onClick={() => setQuestionIndex((index) => index + 1)}>Next</button></div>}
    </Modal>
  </main>;
}
