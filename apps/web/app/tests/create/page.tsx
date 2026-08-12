"use client";

import Link from "next/link";
import { useState } from "react";
import { QuestionCreator } from "../../../components/question-creator";
import {
  createTest,
  type CreateTestInput,
  type QuestionDraftInput,
  uploadQuestionThumbnail,
  uploadQuestionVideo,
  type TestResponse,
  type TestStatus,
} from "../../../lib/question-api";

function normalizeTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

type DraftQuestionEntry = {
  draft: QuestionDraftInput;
  videoFile?: File | null;
  thumbnailFile?: File | null;
};

export default function CreateTestPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<TestStatus>("DRAFT");
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<TestResponse | null>(null);

  function addDraftQuestion(
    draft: QuestionDraftInput,
    media?: { videoFile?: File | null; thumbnailFile?: File | null },
  ) {
    setDraftQuestions((current) => [
      ...current,
      {
        draft: { ...draft, order: current.length + 1 },
        videoFile: media?.videoFile ?? null,
        thumbnailFile: media?.thumbnailFile ?? null,
      },
    ]);
    setSuccess(null);
  }

  function moveDraftQuestion(
  index: number,
  direction: -1 | 1,
) {
  setDraftQuestions((current) => {
    const targetIndex = index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= current.length
    ) {
      return current;
    }

    const reordered = [...current];

    [
      reordered[index],
      reordered[targetIndex],
    ] = [
      reordered[targetIndex],
      reordered[index],
    ];

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
    setDraftQuestions((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((entry, currentIndex) => ({
          ...entry,
          draft: { ...entry.draft, order: currentIndex + 1 },
        })),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: CreateTestInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        tags: normalizeTags(tags),
        status,
        questions: draftQuestions.map((entry) => entry.draft),
      };

      const created = await createTest(payload);

      for (const entry of draftQuestions) {
        const createdQuestion = created.questions.find((question) => question.order === entry.draft.order);
        if (!createdQuestion || entry.draft.type !== "VIDEO") continue;

        if (entry.videoFile) {
          await uploadQuestionVideo(createdQuestion.id, entry.videoFile);
        }
        if (entry.thumbnailFile) {
          await uploadQuestionThumbnail(createdQuestion.id, entry.thumbnailFile);
        }
      }

      setSuccess(created);
      setDraftQuestions([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create test");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pageShell">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <span className="sectionLabel">Create test</span>
            <h2>Build a test with ordered questions</h2>
          </div>
          <p>
            Add test metadata, then use the existing question form to collect ordered question drafts.
          </p>
        </div>

        <form className="formGrid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Senior engineer screening"
              required
            />
          </label>

          <label className="field fieldWide">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional context for this test."
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

          <div className="fieldWide actionsRow">
            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create test"}
            </button>
            <span className="helperText">
              The question order comes from the sequence you add drafts in this page.
            </span>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span className="sectionLabel">Questions</span>
            <h2>Add ordered question drafts</h2>
          </div>
          <p>
            Each submission below becomes one question in the test. The list order is stored as the
            question order.
          </p>
        </div>
        <div className="testBuilderGrid">
          <QuestionCreator
            mode="draft"
            draftOrder={draftQuestions.length + 1}
            onDraftAdded={addDraftQuestion}
          />

          <aside className="detailCard draftSidebar">
            <strong>Draft order</strong>
            {draftQuestions.length === 0 ? (
              <div className="stateCard emptyStateInline">No question drafts yet.</div>
            ) : (
              <ul className="dataList">
                {draftQuestions.map((draft, index) => (
                  <li key={`${index}-${draft.draft.type}`}>
                    <strong>{draft.draft.order}. {draft.draft.title || "Untitled question"}</strong>
                    <span>{draft.draft.type}</span>
                    <div className="draftActions">
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
              </ul>
            )}
          </aside>
        </div>
      </section>

      <div className="feedbackArea">
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {success && (
          <div className="stateCard successState">
            <strong>Test created.</strong>

            <span>
              {success.name} · {success.questions.length} questions
            </span>

            <Link
              className="primaryButton inlineButton"
              href={`/tests/${success.id}`}
            >
              Open test
            </Link>
          </div>
        )}
        {!error && !success && !loading && (
          <div className="stateCard emptyStateInline">
            No test has been created in this session yet.
          </div>
        )}
      </div>
    </main>
  );
}
