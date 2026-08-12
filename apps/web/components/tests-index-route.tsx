"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listTests, type TestSummaryResponse } from "../lib/question-api";

export function TestsIndexRoute() {
  const [tests, setTests] = useState<TestSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await listTests();
        if (!cancelled) {
          setTests(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load tests");
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
          <span className="sectionLabel">Tests</span>
          <h2>All created tests</h2>
        </div>
        <p>Each card opens the candidate test flow for the selected test.</p>
      </div>

      {loading && <div className="stateCard">Loading tests...</div>}
      {error && <div className="stateCard errorState">Error: {error}</div>}
      {!loading && !error && tests.length === 0 && (
        <div className="stateCard emptyStateInline">No tests have been created yet.</div>
      )}

      {!loading && !error && tests.length > 0 && (
        <div className="routeList">
          {tests.map((test) => (
            <article className="routeCard compactRouteCard" key={test.id}>
              <span className="sectionLabel">{test.status}</span>
              <h3>{test.name}</h3>
              <p>{test.description ?? "No description"}</p>
              <div className="routeCardMeta">
                <span className="pill">{test.questionCount} questions</span>
                {test.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <Link className="primaryButton inlineButton" href={`/tests/${encodeURIComponent(test.id)}`}>
                Open candidate test
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
