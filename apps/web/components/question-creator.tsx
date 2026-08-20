"use client";

import { useEffect, useState } from "react";
import {
  createQuestion,
  getQuestion,
  type CreateQuestionInput,
  type QuestionDraftInput,
  type QuestionResponse,
  type QuestionType,
  uploadQuestionThumbnail,
  uploadQuestionVideo,
} from "../lib/question-api";

type QuestionCreatorProps = {
  mode?: "standalone" | "draft";
  draftOrder?: number;
  initialDraft?: QuestionDraftInput | null;
  onCreated?: (question: QuestionResponse) => void;
  onDraftAdded?: (
    draft: QuestionDraftInput,
    media?: { videoFile?: File | null; thumbnailFile?: File | null },
  ) => void;
};

type MultipleChoiceOption = {
  label: string;
  order: number;
  isCorrect: boolean;
};

type FormState = {
  title: string;
  description: string;
  type: QuestionType;
  item: {
    allowMultipleSelection: boolean;
    shuffleOptions: boolean;
    options: MultipleChoiceOption[];
    placeholder: string;
    maxLength: string;
    answerHint: string;
  };
};

const initialState: FormState = {
  title: "",
  description: "",
  type: "VIDEO",
  item: {
    allowMultipleSelection: false,
    shuffleOptions: false,
    options: [
      { label: "", order: 0, isCorrect: true },
      { label: "", order: 1, isCorrect: false },
      { label: "", order: 2, isCorrect: false },
      { label: "", order: 3, isCorrect: false },
    ],
    placeholder: "",
    maxLength: "",
    answerHint: "",
  },
};

function createInitialState(draft?: QuestionDraftInput | null) {
  if (!draft) {
    return initialState;
  }

  if (draft.type === "VIDEO") {
    return {
      title: draft.title,
      description: draft.description ?? "",
      type: draft.type,
      item: {
        allowMultipleSelection: false,
        shuffleOptions: false,
        options: [
          { label: "", order: 0, isCorrect: true },
          { label: "", order: 1, isCorrect: false },
          { label: "", order: 2, isCorrect: false },
          { label: "", order: 3, isCorrect: false },
        ],
        placeholder: "",
        maxLength: "",
        answerHint: "",
      },
    };
  }

  if (draft.type === "MULTIPLE_CHOICE") {
    const item = draft.item as {
      allowMultipleSelection?: boolean;
      shuffleOptions?: boolean;
      options?: Array<{
        label?: string;
        order?: number;
        isCorrect?: boolean;
      }>;
    };

    return {
      title: draft.title,
      description: draft.description ?? "",
      type: draft.type,
      item: {
        allowMultipleSelection: item.allowMultipleSelection === true,
        shuffleOptions: item.shuffleOptions === true,
        options: (item.options ?? []).map((option, index) => ({
          label: option.label ?? "",
          order: typeof option.order === "number" ? option.order : index,
          isCorrect: option.isCorrect === true,
        })),
        placeholder: "",
        maxLength: "",
        answerHint: "",
      },
    };
  }

  const item = draft.item as {
    placeholder?: string | null;
    maxLength?: number | null;
    answerHint?: string | null;
  };

  return {
    title: draft.title,
    description: draft.description ?? "",
    type: draft.type,
    item: {
      allowMultipleSelection: false,
      shuffleOptions: false,
      options: [
        { label: "", order: 0, isCorrect: true },
        { label: "", order: 1, isCorrect: false },
        { label: "", order: 2, isCorrect: false },
        { label: "", order: 3, isCorrect: false },
      ],
      placeholder: item.placeholder ?? "",
      maxLength: item.maxLength === null || item.maxLength === undefined ? "" : String(item.maxLength),
      answerHint: item.answerHint ?? "",
    },
  };
}

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function buildItemPayload(type: QuestionType, state: FormState["item"]) {
  if (type === "VIDEO") {
    return { type };
  }

  if (type === "MULTIPLE_CHOICE") {
    return {
      type,
      allowMultipleSelection: state.allowMultipleSelection,
      shuffleOptions: state.shuffleOptions,
      options: state.options.map((option, index) => ({
        label: option.label,
        value: slugify(option.label, `option_${index + 1}`),
        order: option.order,
        isCorrect: option.isCorrect,
      })),
    };
  }

  return {
    type,
    placeholder: state.placeholder,
    maxLength: state.maxLength === "" ? undefined : Number(state.maxLength),
    answerHint: state.answerHint,
  };
}

export function QuestionCreator({
  mode = "standalone",
  draftOrder = 0,
  initialDraft = null,
  onCreated,
  onDraftAdded,
}: QuestionCreatorProps) {
  const [state, setState] = useState<FormState>(() => createInitialState(initialDraft));
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(initialDraft?.questionId ?? null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<QuestionResponse | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const isDraftMode = mode === "draft";

  useEffect(() => {
    setState(createInitialState(initialDraft));
    setEditingQuestionId(initialDraft?.questionId ?? null);
    setVideoFile(null);
    setThumbnailFile(null);
    setError(null);
    setSuccess(null);
    setDraftNotice(null);
    setLoading(false);
  }, [initialDraft]);

  function updateOption(index: number, next: Partial<MultipleChoiceOption>) {
    setState((current) => {
      const options = [...current.item.options];
      options[index] = { ...options[index], ...next };
      return {
        ...current,
        item: { ...current.item, options },
      };
    });
  }

  function addOption() {
    setState((current) => ({
      ...current,
      item: {
        ...current.item,
        options: [
          ...current.item.options,
          {
            label: "",
            order: current.item.options.length,
            isCorrect: false,
          },
        ],
      },
    }));
  }

  function removeOption(index: number) {
    setState((current) => {
      const options = current.item.options
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({ ...option, order: optionIndex }));
      return {
        ...current,
        item: { ...current.item, options },
      };
    });
  }

  function setSingleCorrect(index: number) {
    setState((current) => ({
      ...current,
      item: {
        ...current.item,
        options: current.item.options.map((option, optionIndex) => ({
          ...option,
          isCorrect: optionIndex === index,
        })),
      },
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDraftNotice(null);

    try {
      const payload: CreateQuestionInput = {
        title: state.title.trim(),
        description: state.description.trim() || undefined,
        type: state.type,
        item: buildItemPayload(state.type, state.item),
      };

      if (isDraftMode) {
        const draft: QuestionDraftInput = {
          ...payload,
          questionId: editingQuestionId ?? undefined,
          order: initialDraft?.order ?? draftOrder,
        };
        onDraftAdded?.(draft, { videoFile, thumbnailFile });
        setDraftNotice(editingQuestionId ? "Question draft updated." : "Question draft added to the test.");
        if (!editingQuestionId) {
          setState(initialState);
          setVideoFile(null);
          setThumbnailFile(null);
        }
        return;
      }

      const created = await createQuestion(payload);

      if (state.type === "VIDEO") {
        if (videoFile) {
          await uploadQuestionVideo(created.id, videoFile);
        }
        if (thumbnailFile) {
          await uploadQuestionThumbnail(created.id, thumbnailFile);
        }
      }

      const refreshed = await getQuestion(created.id);
      setSuccess(refreshed);
      onCreated?.(refreshed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create question");
    } finally {
      setLoading(false);
    }
  }

  const isVideo = state.type === "VIDEO";
  const isMultipleChoice = state.type === "MULTIPLE_CHOICE";
  const canUseMultipleCorrect = state.item.allowMultipleSelection;
  const sectionLabel = isDraftMode ? "Test question" : "Create question";
  const headline = isDraftMode
    ? editingQuestionId
      ? "Edit existing question"
      : "Add a new question"
    : "Reusable screening question form";
  const description = isDraftMode
    ? editingQuestionId
      ? "Update the selected question in place."
      : "Add one ordered question to the test draft at a time."
    : "Create video, multiple choice, or short answer questions with type-aware validation.";

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">{sectionLabel}</span>
          <h2>{headline}</h2>
        </div>
        <p>{description}</p>
      </div>

      <form className="formGrid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input
            value={state.title}
            onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
            placeholder="Why do you want this role?"
            required
          />
        </label>

        <label className="field fieldWide">
          <span>Description</span>
          <textarea
            value={state.description}
            onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
            placeholder="Optional supporting context for recruiters."
            rows={4}
          />
        </label>

        <label className="field">
          <span>Type</span>
          <select
            value={state.type}
            onChange={(event) => {
              const nextType = event.target.value as QuestionType;
              setState((current) => ({
                ...current,
                type: nextType,
                item: nextType === "MULTIPLE_CHOICE" && current.item.options.length < 4
                  ? {
                      ...current.item,
                      options: [
                        { label: "", order: 0, isCorrect: true },
                        { label: "", order: 1, isCorrect: false },
                        { label: "", order: 2, isCorrect: false },
                        { label: "", order: 3, isCorrect: false },
                      ],
                    }
                  : current.item,
              }));
              if (nextType !== "VIDEO") {
                setVideoFile(null);
                setThumbnailFile(null);
              }
            }}
          >
            <option value="VIDEO">Video</option>
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="SHORT_ANSWER">Short answer</option>
          </select>
        </label>

        {isVideo && (
          <div className="fieldWide stack">
            <label className="field">
              <span>Video file</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="field">
              <span>Thumbnail file</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="helperText">
              {isDraftMode
                ? "Video files are stored with the test draft and uploaded after the test creates the question records."
                : "Uploads happen after the question is created. If you skip these files, you can add them later on the view page."}
            </div>
          </div>
        )}

        {isMultipleChoice && (
          <div className="fieldWide stack">
            <label className="checkRow">
              <input
                type="checkbox"
                checked={state.item.allowMultipleSelection}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setState((current) => ({
                    ...current,
                    item: {
                      ...current.item,
                      allowMultipleSelection: checked,
                      options: checked
                        ? current.item.options
                        : current.item.options.map((option, optionIndex) => ({
                            ...option,
                            isCorrect: optionIndex === current.item.options.findIndex((entry) => entry.isCorrect),
                          })),
                    },
                  }));
                }}
              />
              <span>Allow multiple correct answers</span>
            </label>
            <label className="checkRow">
              <input
                type="checkbox"
                checked={state.item.shuffleOptions}
                onChange={(event) => setState((current) => ({
                  ...current,
                  item: { ...current.item, shuffleOptions: event.target.checked },
                }))}
              />
              <span>Shuffle options</span>
            </label>

            <div className="optionList">
              {state.item.options.map((option, index) => (
                <div className="optionCard" key={index}>
                  <input
                    value={option.label}
                    onChange={(event) => updateOption(index, { label: event.target.value })}
                    placeholder={`Option ${index + 1}`}
                  />
                  <div className="optionMeta">
                    <span className="optionValuePreview">
                      Value: {slugify(option.label, `option_${index + 1}`)}
                    </span>
                    <button type="button" className="ghostButton" onClick={() => removeOption(index)}>
                      Remove
                    </button>
                  </div>
                  {canUseMultipleCorrect ? (
                    <label className="checkRow compact">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(event) => updateOption(index, { isCorrect: event.target.checked })}
                      />
                      <span>Correct answer</span>
                    </label>
                  ) : (
                    <label className="checkRow compact">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={option.isCorrect}
                        onChange={() => setSingleCorrect(index)}
                      />
                      <span>Correct answer</span>
                    </label>
                  )}
                </div>
              ))}
              <button type="button" className="ghostButton" onClick={addOption}>
                Add option
              </button>
            </div>
            <div className="helperText">
              Enter plain option text. The API value is generated automatically from the text.
            </div>
          </div>
        )}

        {state.type === "SHORT_ANSWER" && (
          <div className="fieldWide gridTwo">
            <label className="field">
              <span>Placeholder</span>
              <input
                value={state.item.placeholder}
                onChange={(event) => setState((current) => ({
                  ...current,
                  item: { ...current.item, placeholder: event.target.value },
                }))}
                placeholder="Type your answer here"
              />
            </label>
            <label className="field">
              <span>Max length</span>
              <input
                type="number"
                min={1}
                value={state.item.maxLength}
                onChange={(event) => setState((current) => ({
                  ...current,
                  item: { ...current.item, maxLength: event.target.value },
                }))}
              />
            </label>
            <label className="field fieldWide">
              <span>Answer hint</span>
              <input
                value={state.item.answerHint}
                onChange={(event) => setState((current) => ({
                  ...current,
                  item: { ...current.item, answerHint: event.target.value },
                }))}
                placeholder="Strong answer should mention ..."
              />
            </label>
          </div>
        )}

        <div className="fieldWide actionsRow">
          <button className="primaryButton" type="submit" disabled={loading}>
            {loading ? "Saving..." : isDraftMode ? (editingQuestionId ? "Save question" : "Add question") : "Create question"}
          </button>
          <span className="helperText">
            {isDraftMode
              ? editingQuestionId
                ? "Changes will update the selected question in the draft."
                : "This question will be saved as part of the test and can be refined later."
              : isVideo
              ? "Video questions can upload media immediately in this form, or later on the view page."
              : "Item fields are validated before the question is saved."}
          </span>
        </div>
      </form>

      <div className="feedbackArea">
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {draftNotice && <div className="stateCard successState">{draftNotice}</div>}
        {success && !isDraftMode && (
          <div className="stateCard successState">
            <strong>Created</strong>
            <pre>{JSON.stringify(success, null, 2)}</pre>
          </div>
        )}
        {!error && !success && !draftNotice && !loading && (
          <div className="stateCard emptyStateInline">
            No question has been created in this session yet.
          </div>
        )}
      </div>
    </section>
  );
}
