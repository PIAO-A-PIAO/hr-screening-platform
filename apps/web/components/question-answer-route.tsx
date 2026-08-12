"use client";

import { useEffect, useState } from "react";
import { QuestionAnswerer, createEmptyAnswer, type CandidateAnswer } from "./question-answerer";
import { getQuestion, type QuestionResponse } from "../lib/question-api";

type QuestionAnswerRouteProps = {
  initialQuestionId?: string;
};

export function QuestionAnswerRoute({ initialQuestionId = "" }: QuestionAnswerRouteProps) {
  const [questionId, setQuestionId] = useState(initialQuestionId);
  const [submittedId, setSubmittedId] = useState(initialQuestionId);
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<CandidateAnswer>(createEmptyAnswer());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setQuestionId(initialQuestionId);
    setSubmittedId(initialQuestionId);
  }, [initialQuestionId]);

  useEffect(() => {
    if (!submittedId) {
      setQuestion(null);
      setError(null);
      setLoading(false);
      setAnswer(createEmptyAnswer());
      setSaved(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSaved(false);

      try {
        const loaded = await getQuestion(submittedId);
        if (!cancelled) {
          setQuestion(loaded);
          setAnswer(createEmptyAnswer());
        }
      } catch (caught) {
        if (!cancelled) {
          setQuestion(null);
          setError(caught instanceof Error ? caught.message : "Failed to load question");
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
  }, [submittedId]);

  function handleLoadQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedId(questionId.trim());
  }

  function handleSaveAnswer() {
    setSaved(true);
  }

  return (
    <section className="panel candidateAnswerShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Answer question</span>
          <h2>Candidate preview</h2>
        </div>
        <p>
          Load a question by ID, answer it the way a candidate would, and keep the response local in this preview.
        </p>
      </div>

      <form className="lookupBar" onSubmit={handleLoadQuestion}>
        <input
          value={questionId}
          onChange={(event) => setQuestionId(event.target.value)}
          placeholder="Paste a questionId here"
        />
        <button className="primaryButton" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Load question"}
        </button>
      </form>

      <div className="feedbackArea">
        {!submittedId && <div className="stateCard emptyStateInline">Enter a question ID to load the candidate view.</div>}
        {loading && <div className="stateCard">Loading question...</div>}
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {!loading && !error && !question && submittedId && (
          <div className="stateCard emptyStateInline">No question returned for that ID.</div>
        )}
      </div>

      {question && (
        <div className="candidateFlow">
          <QuestionAnswerer question={question} value={answer} onChange={setAnswer} />

          <div className="candidateActions">
            <div className="stateCard candidateStatusCard">
              <strong>Local response</strong>
              {question.type === "MULTIPLE_CHOICE" ? (
                <span>
                  {answer.selectedValues.length === 0
                    ? "No options selected yet."
                    : `${answer.selectedValues.length} option(s) selected.`}
                </span>
              ) : (
                <span>
                  {answer.text.trim().length === 0
                    ? "No response written yet."
                    : `${answer.text.trim().length} characters entered.`}
                </span>
              )}
              {saved && <span className="inlineStatus">Saved locally for this preview.</span>}
            </div>

            <button className="primaryButton" type="button" onClick={handleSaveAnswer}>
              Save response locally
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
