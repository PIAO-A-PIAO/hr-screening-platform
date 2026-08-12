"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listQuestions, type QuestionListItem } from "../lib/question-api";

export function QuestionsIndexRoute() {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await listQuestions();
        if (!cancelled) {
          setQuestions(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load questions");
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
  }, []);

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Questions</span>
          <h2>All created questions</h2>
        </div>
        <p>Use these links to open the candidate answer view for any question in the system.</p>
      </div>

      {loading && <div className="stateCard">Loading questions...</div>}
      {error && <div className="stateCard errorState">Error: {error}</div>}
      {!loading && !error && questions.length === 0 && (
        <div className="stateCard emptyStateInline">No questions have been created yet.</div>
      )}

      {!loading && !error && questions.length > 0 && (
        <div className="routeList">
          {questions.map((question) => (
            <article className="routeCard compactRouteCard" key={question.id}>
              <span className="sectionLabel">{question.type.replaceAll("_", " ")}</span>
              <h3>{question.title}</h3>
              <p>{question.description ?? "No description"}</p>
              <div className="routeCardMeta">
                <span className="pill">{new Date(question.createdAt).toLocaleDateString()}</span>
              </div>
              <Link className="primaryButton inlineButton" href={`/questions/view?questionId=${encodeURIComponent(question.id)}`}>
                Open candidate view
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
