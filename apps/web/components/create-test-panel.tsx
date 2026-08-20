"use client";

import { useEffect, useState } from "react";
import { QuestionCreator } from "./question-creator";
import {
  createTest,
  getTest,
  updateTest,
  type CreateTestInput,
  type QuestionDraftInput,
  type TestResponse,
  type TestStatus,
  uploadQuestionThumbnail,
  uploadQuestionVideo,
} from "../lib/question-api";
import type { PositionResponse } from "../lib/position-api";

type DraftQuestionEntry = {
  clientId: string;
  draft: QuestionDraftInput;
  videoFile?: File | null;
  thumbnailFile?: File | null;
};

type CreateTestPanelProps = {
  position: PositionResponse;
  className?: string;
};

function normalizeTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function makeClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toDraftEntry(question: TestResponse["questions"][number]): DraftQuestionEntry {
  if (question.type === "VIDEO") {
    return {
      clientId: question.id,
      draft: {
        questionId: question.id,
        order: question.order,
        title: question.title,
        description: question.description ?? undefined,
        type: question.type,
        item: { type: "VIDEO" },
      },
      videoFile: null,
      thumbnailFile: null,
    };
  }

  if (question.type === "MULTIPLE_CHOICE") {
    const item = question.item as {
      allowMultipleSelection?: boolean;
      shuffleOptions?: boolean;
      options?: Array<{
        label?: string;
        value?: string;
        order?: number;
        isCorrect?: boolean;
      }>;
    };

    return {
      clientId: question.id,
      draft: {
        questionId: question.id,
        order: question.order,
        title: question.title,
        description: question.description ?? undefined,
        type: question.type,
        item: {
          type: "MULTIPLE_CHOICE",
          allowMultipleSelection: item.allowMultipleSelection === true,
          shuffleOptions: item.shuffleOptions === true,
          options: (item.options ?? []).map((option, index) => ({
            label: option.label ?? "",
            value: option.value ?? `option_${index + 1}`,
            order: typeof option.order === "number" ? option.order : index,
            isCorrect: option.isCorrect === true,
          })),
        },
      },
      videoFile: null,
      thumbnailFile: null,
    };
  }

  const item = question.item as {
    placeholder?: string | null;
    maxLength?: number | null;
    answerHint?: string | null;
  };

  return {
    clientId: question.id,
    draft: {
      questionId: question.id,
      order: question.order,
      title: question.title,
      description: question.description ?? undefined,
      type: question.type,
      item: {
        type: "SHORT_ANSWER",
        placeholder: item.placeholder ?? "",
        maxLength: item.maxLength ?? undefined,
        answerHint: item.answerHint ?? "",
      },
    },
    videoFile: null,
    thumbnailFile: null,
  };
}

export function CreateTestPanel({ position, className }: CreateTestPanelProps) {
  const [attachedTestId, setAttachedTestId] = useState<string | null>(position.test?.id ?? null);
  const [attachedTest, setAttachedTest] = useState<TestResponse | null>(null);
  const [attachedLoading, setAttachedLoading] = useState(false);
  const [attachedError, setAttachedError] = useState<string | null>(null);
  const [testName, setTestName] = useState(position.test?.name ?? position.title);
  const [testDescription, setTestDescription] = useState(position.test?.description ?? position.description ?? "");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<TestStatus>(position.test?.status ?? "DRAFT");
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestionEntry[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<TestResponse | null>(null);

  useEffect(() => {
    setAttachedTestId(position.test?.id ?? null);
    setAttachedTest(null);
    setAttachedError(null);
    setTestName(position.test?.name ?? position.title);
    setTestDescription(position.test?.description ?? position.description ?? "");
    setTags("");
    setStatus(position.test?.status ?? "DRAFT");
    setDraftQuestions([]);
    setSelectedDraftId(null);
    setSuccess(null);
    setError(null);
  }, [position.id, position.title, position.description, position.test?.id, position.test?.name, position.test?.description, position.test?.status, position.test?.questionCount]);

  useEffect(() => {
    const testId = attachedTestId ?? "";
    if (testId.length === 0) {
      setAttachedTest(null);
      setAttachedLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setAttachedLoading(true);
      setAttachedError(null);

      try {
        const loaded = await getTest(testId);
        if (cancelled) {
          return;
        }

        const entries = loaded.questions.map(toDraftEntry);
        setAttachedTest(loaded);
        setTestName(loaded.name);
        setTestDescription(loaded.description ?? "");
        setTags(loaded.tags.join(", "));
        setStatus(loaded.status);
        setDraftQuestions(entries);
        setSelectedDraftId(entries[0]?.clientId ?? null);
      } catch (caught) {
        if (!cancelled) {
          setAttachedError(caught instanceof Error ? caught.message : "Failed to load attached test");
          setAttachedTest(null);
        }
      } finally {
        if (!cancelled) {
          setAttachedLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [attachedTestId]);

  const selectedDraft = selectedDraftId
    ? draftQuestions.find((entry) => entry.clientId === selectedDraftId) ?? null
    : null;

  function saveDraftQuestion(
    draft: QuestionDraftInput,
    media?: { videoFile?: File | null; thumbnailFile?: File | null },
  ) {
    setDraftQuestions((current) => {
      const targetIndex = selectedDraftId
        ? current.findIndex((entry) => entry.clientId === selectedDraftId)
        : -1;
      const clientId = targetIndex >= 0 ? current[targetIndex].clientId : makeClientId();
      const nextDraft: DraftQuestionEntry = {
        clientId,
        draft: {
          ...draft,
          order: targetIndex >= 0 ? current[targetIndex].draft.order : current.length + 1,
        },
        videoFile: media?.videoFile ?? null,
        thumbnailFile: media?.thumbnailFile ?? null,
      };

      if (targetIndex >= 0) {
        const updated = [...current];
        updated[targetIndex] = nextDraft;
        return updated;
      }

      return [...current, nextDraft];
    });
    setSuccess(null);
  }

  function moveDraftQuestion(index: number, direction: -1 | 1) {
    setDraftQuestions((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

      return reordered.map((entry, currentIndex) => ({
        ...entry,
        draft: {
          ...entry.draft,
          order: currentIndex + 1,
        },
      }));
    });

    setSuccess(null);
  }

  function removeDraftQuestion(index: number) {
    setDraftQuestions((current) => {
      const removed = current[index];
      const next = current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((entry, currentIndex) => ({
          ...entry,
          draft: { ...entry.draft, order: currentIndex + 1 },
        }));

      if (removed?.clientId === selectedDraftId) {
        setSelectedDraftId(next[index]?.clientId ?? next[next.length - 1]?.clientId ?? null);
      }

      return next;
    });
    setSuccess(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: CreateTestInput = {
        name: testName.trim(),
        description: testDescription.trim() || undefined,
        tags: normalizeTags(tags),
        status,
        positionId: position.id,
        questions: draftQuestions.map((entry) => entry.draft),
      };

      const saved = attachedTestId
        ? await updateTest(attachedTestId, payload)
        : await createTest(payload);

      for (const entry of draftQuestions) {
        if (entry.draft.type !== "VIDEO") {
          continue;
        }

        const savedQuestion = saved.questions.find((question) => question.order === entry.draft.order);
        if (!savedQuestion) {
          continue;
        }

        if (entry.videoFile) {
          await uploadQuestionVideo(savedQuestion.id, entry.videoFile);
        }
        if (entry.thumbnailFile) {
          await uploadQuestionThumbnail(savedQuestion.id, entry.thumbnailFile);
        }
      }

      setSuccess(saved);
      setAttachedTestId(saved.id);
      setAttachedTest(saved);
      setTestName(saved.name);
      setTestDescription(saved.description ?? "");
      setTags(saved.tags.join(", "));
      setStatus(saved.status);

      const refreshedEntries = saved.questions.map(toDraftEntry);
      setDraftQuestions(refreshedEntries);

      if (selectedDraft?.draft.questionId) {
        setSelectedDraftId(selectedDraft.draft.questionId);
      } else {
        setSelectedDraftId(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save test");
    } finally {
      setLoading(false);
    }
  }

  const isEditingAttachedTest = attachedTestId !== null;
  const submitLabel = isEditingAttachedTest ? "Save test" : "Create test";
  const helperText = isEditingAttachedTest
    ? "Edit the attached test in place. Existing questions are loaded into the builder."
    : "The position is already chosen. Add ordered question drafts to create the screening test.";

  return (
    <details className={`detailCard attachedTestAccordion ${className ?? ""}`} open>
      <summary className="attachedTestSummary">
        <div>
          <span className="sectionLabel">Attached test</span>
          <h3>{attachedTest?.name ?? position.test?.name ?? position.title}</h3>
        </div>
        <div className="attachedTestSummaryMeta">
          <span className="pill">{attachedTest?.status ?? position.test?.status ?? "Draft"}</span>
          <span className="pill">{attachedTest?.questions.length ?? position.test?.questionCount ?? 0} questions</span>
        </div>
      </summary>

      <div className="attachedTestBody">
        {attachedLoading && <div className="stateCard">Loading attached test...</div>}
        {attachedError && <div className="stateCard errorState">Error: {attachedError}</div>}

        {!attachedLoading && !attachedError && !attachedTest && (
          <div className="stateCard emptyStateInline">
            This position does not have a test yet. The panel is open so you can create one immediately.
          </div>
        )}

        <form id={`create-test-form-${position.id}`} className="formGrid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              value={testName}
              onChange={(event) => setTestName(event.target.value)}
              placeholder="Screening test title"
              required
            />
          </label>

          <label className="field fieldWide">
            <span>Description</span>
            <textarea
              value={testDescription}
              onChange={(event) => setTestDescription(event.target.value)}
              placeholder="Optional notes for recruiters."
              rows={3}
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as TestStatus)}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>

          <label className="field">
            <span>Tags</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="engineering, senior, async"
            />
          </label>
        </form>

        <div className="testBuilderGrid">
          <QuestionCreator
            mode="draft"
            draftOrder={selectedDraft?.draft.order ?? draftQuestions.length + 1}
            initialDraft={selectedDraft?.draft ?? null}
            onDraftAdded={saveDraftQuestion}
          />

          <aside className="detailCard draftSidebar">
            <strong>Draft order</strong>
            <ul className="dataList draftOrderList">
              {draftQuestions.map((draft, index) => (
                <li
                  key={draft.clientId}
                  className={`draftCard ${selectedDraftId === draft.clientId ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDraftId(draft.clientId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDraftId(draft.clientId);
                    }
                  }}
                >
                  <strong>
                    {draft.draft.order}. {draft.draft.title || "Untitled question"}
                  </strong>
                  <span>
                    {draft.draft.type}
                    {draft.draft.questionId ? " . existing" : " . new"}
                  </span>
                  <div className="draftActions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="ghostButton compactButton"
                      onClick={() => moveDraftQuestion(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>

                    <button
                      type="button"
                      className="ghostButton compactButton"
                      onClick={() => moveDraftQuestion(index, 1)}
                      disabled={index === draftQuestions.length - 1}
                    >
                      Down
                    </button>

                    <button
                      type="button"
                      className="ghostButton compactButton"
                      onClick={() => removeDraftQuestion(index)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}

              <li
                className={`draftCard draftCardEmpty ${selectedDraftId === null ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDraftId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedDraftId(null);
                  }
                }}
              >
                <strong>Add a new question</strong>
                <span>Click to open a blank draft</span>
              </li>
            </ul>
          </aside>
        </div>

        <div className="feedbackArea">
          {error && <div className="stateCard errorState">Error: {error}</div>}
          {success && (
            <div className="stateCard successState">
              <strong>Test saved.</strong>
              <span>
                {success.name} . {success.questions.length} questions
              </span>
            </div>
          )}
          {!error && !success && !loading && (
            <div className="stateCard emptyStateInline">
              {helperText}
            </div>
          )}
        </div>

        <div className="actionsRow">
          <button
            className="primaryButton"
            type="submit"
            form={`create-test-form-${position.id}`}
            disabled={loading || draftQuestions.length === 0 || (isEditingAttachedTest && !attachedTest)}
          >
            {loading ? "Saving..." : submitLabel}
          </button>
          <span className="helperText">{helperText}</span>
        </div>
      </div>
    </details>
  );
}
