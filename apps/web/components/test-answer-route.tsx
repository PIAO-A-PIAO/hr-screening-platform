"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionAnswerer, createEmptyAnswer, type CandidateAnswer } from "./question-answerer";
import { getTest, type TestResponse } from "../lib/question-api";

type TestAnswerRouteProps = {
  testId: string;
};

export function TestAnswerRoute({ testId }: TestAnswerRouteProps) {
  const [test, setTest] = useState<TestResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, CandidateAnswer>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSubmitted(false);

      try {
        const loaded = await getTest(testId);
        if (!cancelled) {
          setTest(loaded);
          setActiveIndex(0);
          setAnswers({});
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load test");
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

  const activeQuestion = useMemo(() => test?.questions[activeIndex] ?? null, [test, activeIndex]);

  function updateAnswer(questionIdValue: string, nextValue: CandidateAnswer) {
    setAnswers((current) => ({
      ...current,
      [questionIdValue]: nextValue,
    }));
  }

  function currentAnswerFor(questionIdValue: string) {
    return answers[questionIdValue] ?? createEmptyAnswer();
  }

  function moveQuestion(direction: -1 | 1) {
    if (!test) return;
    setActiveIndex((current) => {
      const nextIndex = current + direction;
      if (nextIndex < 0 || nextIndex >= test.questions.length) {
        return current;
      }
      return nextIndex;
    });
  }

  function finishTest() {
    setSaving(true);
    setSubmitted(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="pageShell">
        <div className="stateCard">Loading test...</div>
      </main>
    );
  }

  if (error && !test) {
    return (
      <main className="pageShell">
        <div className="stateCard errorState">Error: {error}</div>
      </main>
    );
  }

  if (!test) {
    return (
      <main className="pageShell">
        <div className="stateCard">Test not found.</div>
      </main>
    );
  }

  const answeredCount = test.questions.filter((question) => {
    const answer = answers[question.id];
    if (!answer) return false;
    if (question.type === "MULTIPLE_CHOICE") {
      return answer.selectedValues.length > 0;
    }
    return answer.text.trim().length > 0;
  }).length;

  const activeAnswer = activeQuestion ? currentAnswerFor(activeQuestion.id) : createEmptyAnswer();

  return (
    <main className="pageShell">
      <section className="panel candidateTestHeader">
        <div className="panelHeader">
          <div>
            <span className="sectionLabel">Candidate test</span>
            <h2>{test.name}</h2>
          </div>
          <p>{test.description ?? "No description"}</p>
        </div>

        <div className="pillRow">
          <span className="pill">{test.questions.length} questions</span>
          <span className="pill">{answeredCount} answered</span>
          {test.tags.map((tag) => (
            <span className="pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </section>

      {error && <div className="stateCard errorState">Error: {error}</div>}

      <section className="candidateTestLayout">
        <aside className="detailCard candidateSidebar">
          <div className="railHeader">
            <div>
              <span className="sectionLabel">Progress</span>
              <strong>Answer flow</strong>
            </div>
            <div className="answerCounter">
              Question {activeIndex + 1} of {test.questions.length}
            </div>
          </div>

          <ol className="candidateQuestionList">
            {test.questions.map((question, index) => {
              const answer = answers[question.id];
              const answered =
                question.type === "MULTIPLE_CHOICE"
                  ? (answer?.selectedValues.length ?? 0) > 0
                  : (answer?.text.trim().length ?? 0) > 0;

              return (
                <li key={question.id} className={index === activeIndex ? "active" : ""}>
                  <button className="candidateQuestionButton" type="button" onClick={() => setActiveIndex(index)}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{question.title}</strong>
                      <small>{question.type.replaceAll("_", " ")}</small>
                    </div>
                  </button>
                  <div className={answered ? "progressChip done" : "progressChip"}>{answered ? "Answered" : "Pending"}</div>
                </li>
              );
            })}
          </ol>

          <div className="candidateActionsStack">
            <button className="ghostButton" type="button" onClick={() => moveQuestion(-1)} disabled={activeIndex === 0}>
              Previous
            </button>
            <button
              className="primaryButton"
              type="button"
              onClick={() => moveQuestion(1)}
              disabled={activeIndex === test.questions.length - 1}
            >
              Next
            </button>
          </div>
        </aside>

        <section className="panel candidateStage">
          {activeQuestion ? (
            <>
              <div className="stageCounter">
                Question {activeIndex + 1} of {test.questions.length}
              </div>

              <QuestionAnswerer
                key={activeQuestion.id}
                question={activeQuestion}
                value={activeAnswer}
                onChange={(nextValue) => updateAnswer(activeQuestion.id, nextValue)}
              />

              <div className="candidateFooter">
                <div className="stateCard candidateStatusCard">
                  <strong>Local test preview</strong>
                  <span>
                    Your response is kept in this browser session until the candidate workflow is connected to a submit endpoint.
                  </span>
                </div>

                <div className="stepperActions">
                  <button className="ghostButton" type="button" onClick={() => moveQuestion(-1)} disabled={activeIndex === 0}>
                    Previous
                  </button>
                  {activeIndex < test.questions.length - 1 ? (
                    <button className="primaryButton" type="button" onClick={() => moveQuestion(1)}>
                      Next
                    </button>
                  ) : (
                    <button className="primaryButton" type="button" onClick={finishTest} disabled={saving}>
                      {saving ? "Saving..." : submitted ? "Finished" : "Finish test"}
                    </button>
                  )}
                </div>
              </div>

              {submitted && (
                <div className="stateCard successState candidateSubmissionState">
                  <strong>Preview complete.</strong>
                  <span>This test view does not persist answers yet, so the submission stays local.</span>
                </div>
              )}
            </>
          ) : (
            <div className="stateCard emptyStateInline">No question selected.</div>
          )}
        </section>
      </section>
    </main>
  );
}
