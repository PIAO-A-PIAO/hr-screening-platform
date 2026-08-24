"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionAnswerer, createEmptyAnswer, type CandidateAnswer } from "./question-answerer";
import { getTest, type TestResponse } from "../lib/question-api";
import {
  resolveInviteToken,
  saveAttemptResponse,
  startAttempt,
  submitAttempt,
  type AttemptResponse,
  type SaveAttemptResponseDraft,
} from "../lib/attempt-api";
import { uploadResponseVideo } from "../lib/response-api";

type TestAnswerRouteProps = {
  testId: string;
  inviteToken?: string;
};

function isAnswered(
  question: TestResponse["questions"][number],
  answer: CandidateAnswer,
  recording: File | null,
) {
  if (question.type === "VIDEO") {
    return recording !== null;
  }

  if (question.type === "MULTIPLE_CHOICE") {
    return answer.selectedValues.length > 0;
  }

  return answer.text.trim().length > 0;
}

function isQuestionAnswered(
  question: TestResponse["questions"][number],
  answer: CandidateAnswer,
  recording: File | null,
) {
  return isAnswered(question, answer, recording);
}

function buildSavePayload(
  question: TestResponse["questions"][number],
  answer: CandidateAnswer,
): SaveAttemptResponseDraft {
  if (question.type === "MULTIPLE_CHOICE") {
    const options = (question.item as {
      options?: Array<{ id: string; value: string }>;
    }).options ?? [];
    const selectedOptionIds = answer.selectedValues
      .map((selectedValue) => options.find((option) => option.value === selectedValue)?.id)
      .filter((value): value is string => Boolean(value));

    return {
      type: question.type,
      questionId: question.id,
      item: { selectedOptionIds },
    };
  }

  if (question.type === "SHORT_ANSWER") {
    return {
      type: question.type,
      questionId: question.id,
      item: { textValue: answer.text },
    };
  }

  return {
    type: question.type,
    questionId: question.id,
    item: {},
  };
}

export function TestAnswerRoute({ testId, inviteToken }: TestAnswerRouteProps) {
  const [test, setTest] = useState<TestResponse | null>(null);
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, CandidateAnswer>>({});
  const [videoRecordings, setVideoRecordings] = useState<Record<string, File | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSubmitted(false);
      setAttempt(null);
      setVideoRecordings({});

      try {
        const loaded = await getTest(testId);
        if (!cancelled) {
          setTest(loaded);
          setActiveIndex(0);
          setAnswers({});
          setVideoRecordings({});
        }

        const normalizedToken = inviteToken?.trim();
        if (!normalizedToken) {
          if (!cancelled) {
            setError("Invitation token is required to submit this test.");
          }
          return;
        }

        const resolved = await resolveInviteToken(normalizedToken);
        if (resolved.testId !== testId) {
          throw new Error("Invitation token does not match this test.");
        }

        const started = await startAttempt(
          {
            userId: resolved.userId,
            testId: resolved.testId,
          },
          normalizedToken,
        );

        if (!cancelled) {
          setAttempt(started);
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
  }, [testId, inviteToken]);

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

  function currentVideoRecordingFor(questionIdValue: string) {
    return videoRecordings[questionIdValue] ?? null;
  }

  function updateVideoRecording(questionIdValue: string, file: File | null) {
    setVideoRecordings((current) => ({
      ...current,
      [questionIdValue]: file,
    }));
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

  async function finishTest() {
    if (!test) {
      return;
    }
    if (!attempt) {
      setError("The attempt is not ready yet.");
      return;
    }

    const unanswered = test.questions.filter((question) => {
      const answer = answers[question.id] ?? createEmptyAnswer();
      const recording = currentVideoRecordingFor(question.id);
      return !isQuestionAnswered(question, answer, recording);
    });

    if (unanswered.length > 0) {
      setError("Answer every question before finishing the test.");
      return;
    }

    setSaving(true);
    setError(null);

    const normalizedToken = inviteToken?.trim();
    if (!normalizedToken) {
      setSaving(false);
      setError("Invitation token is required to submit this test.");
      return;
    }

    try {
      for (const question of test.questions) {
        const answer = answers[question.id] ?? createEmptyAnswer();
        const payload = buildSavePayload(question, answer);
        const savedResponse = await saveAttemptResponse(
          attempt.id,
          {
            ...payload,
            userId: attempt.userId,
            testId: attempt.testId,
          },
          normalizedToken,
        );

        if (question.type === "VIDEO") {
          const recording = currentVideoRecordingFor(question.id);
          if (!recording) {
            throw new Error(`Missing video recording for question ${question.id}`);
          }
          await uploadResponseVideo(savedResponse.id, recording, normalizedToken);
        }
      }

      const submittedAttempt = await submitAttempt(attempt.id, normalizedToken);
      setAttempt(submittedAttempt);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to submit attempt");
    } finally {
      setSaving(false);
    }
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
    const recording = currentVideoRecordingFor(question.id);
    if (!answer && question.type !== "VIDEO") return false;
    return isQuestionAnswered(question, answer ?? createEmptyAnswer(), recording);
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
              const answered = isQuestionAnswered(
                question,
                answer ?? createEmptyAnswer(),
                currentVideoRecordingFor(question.id),
              );

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
                videoMode={activeQuestion.type === "VIDEO" ? "record" : "text"}
                onVideoRecordingReady={
                  activeQuestion.type === "VIDEO"
                    ? (file) => updateVideoRecording(activeQuestion.id, file)
                    : undefined
                }
              />

              {activeQuestion.type === "VIDEO" && currentVideoRecordingFor(activeQuestion.id) && (
                <div className="stateCard successState candidateSubmissionState">
                  <strong>Video recorded.</strong>
                  <span>The recording will be uploaded when you finish the test.</span>
                </div>
              )}

              <div className="candidateFooter">
              <div className="stateCard candidateStatusCard">
                  <strong>Candidate submission</strong>
                  <span>
                    Responses are saved to the backend when you finish the test.
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
                    <button className="primaryButton" type="button" onClick={() => void finishTest()} disabled={saving || submitted}>
                      {saving ? "Saving..." : submitted ? "Finished" : "Finish test"}
                    </button>
                  )}
                </div>
              </div>

              {submitted && (
                <div className="stateCard successState candidateSubmissionState">
                  <strong>Submission complete.</strong>
                  <span>The attempt has been submitted to the backend.</span>
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
