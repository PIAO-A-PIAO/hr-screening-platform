"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { QuestionViewer } from "../../../components/question-viewer";

import {
  getTest,
  reorderTestQuestions,
  type TestResponse,
} from "../../../lib/question-api";

export default function TestViewPage() {
  const params = useParams<{ testId: string }>();
  const testId = params.testId;

  const [test, setTest] =
    useState<TestResponse | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);

  const [loading, setLoading] = useState(true);

  const [savingOrder, setSavingOrder] =
    useState(false);

  const [orderDirty, setOrderDirty] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await getTest(testId);

        if (!cancelled) {
          setTest(loaded);
          setActiveIndex(0);
          setOrderDirty(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to load test",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [testId]);

  const activeQuestion = useMemo(() => {
    return test?.questions[activeIndex] ?? null;
  }, [test, activeIndex]);

  function moveQuestion(
    index: number,
    direction: -1 | 1,
  ) {
    if (!test) return;

    const targetIndex = index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= test.questions.length
    ) {
      return;
    }

    const questions = [...test.questions];

    [
      questions[index],
      questions[targetIndex],
    ] = [
      questions[targetIndex],
      questions[index],
    ];

    const reordered = questions.map(
      (question, currentIndex) => ({
        ...question,
        order: currentIndex + 1,
      }),
    );

    setTest({
      ...test,
      questions: reordered,
    });

    setActiveIndex(targetIndex);
    setOrderDirty(true);
  }

  async function saveOrder() {
    if (!test) return;

    setSavingOrder(true);
    setError(null);

    try {
      const updated =
        await reorderTestQuestions(
          test.id,
          test.questions.map(
            (question) => question.id,
          ),
        );

      setTest(updated);
      setOrderDirty(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to save question order",
      );
    } finally {
      setSavingOrder(false);
    }
  }

  if (loading) {
    return (
      <main className="pageShell">
        <div className="stateCard">
          Loading test...
        </div>
      </main>
    );
  }

  if (error && !test) {
    return (
      <main className="pageShell">
        <div className="stateCard errorState">
          Error: {error}
        </div>
      </main>
    );
  }

  if (!test) {
    return (
      <main className="pageShell">
        <div className="stateCard">
          Test not found.
        </div>
      </main>
    );
  }

  return (
    <main className="pageShell">

      <section className="panel testHeaderPanel">
        <div className="panelHeader">
          <div>
            <span className="sectionLabel">
              Test builder
            </span>

            <h2>{test.name}</h2>
          </div>

          <p>
            {test.description ??
              "No description"}
          </p>
        </div>

        <div className="pillRow">
          <span className="pill">
            {test.status}
          </span>

          <span className="pill">
            {test.questions.length} questions
          </span>

          {test.tags.map((tag) => (
            <span
              className="pill"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {error && (
        <div className="stateCard errorState">
          Error: {error}
        </div>
      )}

      <section className="testEditorLayout">

        <aside className="detailCard testQuestionRail">

          <div className="railHeader">
            <div>
              <span className="sectionLabel">
                Questions
              </span>

              <strong>
                Interview flow
              </strong>
            </div>

            <button
              className="primaryButton compactButton"
              type="button"
              onClick={() => void saveOrder()}
              disabled={
                !orderDirty || savingOrder
              }
            >
              {savingOrder
                ? "Saving..."
                : orderDirty
                  ? "Save order"
                  : "Saved"}
            </button>
          </div>

          {test.questions.length === 0 ? (
            <div className="stateCard emptyStateInline">
              This test has no questions yet.
            </div>
          ) : (
            <ol className="questionRailList">

              {test.questions.map(
                (question, index) => (

                  <li
                    key={question.id}
                    className={
                      index === activeIndex
                        ? "active"
                        : ""
                    }
                  >

                    <button
                      className="questionRailMain"
                      type="button"
                      onClick={() =>
                        setActiveIndex(index)
                      }
                    >

                      <span>
                        {index + 1}
                      </span>

                      <div>
                        <strong>
                          {question.title}
                        </strong>

                        <small>
                          {question.type.replaceAll(
                            "_",
                            " ",
                          )}
                        </small>
                      </div>

                    </button>

                    <div className="railActions">

                      <button
                        className="ghostButton compactButton"
                        type="button"
                        onClick={() =>
                          moveQuestion(index, -1)
                        }
                        disabled={index === 0}
                      >
                        ↑
                      </button>

                      <button
                        className="ghostButton compactButton"
                        type="button"
                        onClick={() =>
                          moveQuestion(index, 1)
                        }
                        disabled={
                          index ===
                          test.questions.length - 1
                        }
                      >
                        ↓
                      </button>

                    </div>

                  </li>
                ),
              )}

            </ol>
          )}

          <Link
            className="ghostButton inlineButton"
            href="/tests/create"
          >
            Create another test
          </Link>

        </aside>

        <section className="panel testQuestionStage">

          {activeQuestion ? (
            <>

              <div className="stageCounter">
                Question {activeIndex + 1} of{" "}
                {test.questions.length}
              </div>

              <QuestionViewer
                key={activeQuestion.id}
                initialQuestionId={
                  activeQuestion.id
                }
                embedded
              />

              <div className="stepperActions">

                <button
                  className="ghostButton"
                  type="button"
                  onClick={() =>
                    setActiveIndex((current) =>
                      Math.max(
                        0,
                        current - 1,
                      ),
                    )
                  }
                  disabled={activeIndex === 0}
                >
                  Previous
                </button>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    setActiveIndex((current) =>
                      Math.min(
                        test.questions.length - 1,
                        current + 1,
                      ),
                    )
                  }
                  disabled={
                    activeIndex ===
                    test.questions.length - 1
                  }
                >
                  Next
                </button>

              </div>

            </>
          ) : (
            <div className="stateCard emptyStateInline">
              No question selected.
            </div>
          )}

        </section>

      </section>
    </main>
  );
}