"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPosition, type PositionResponse } from "../lib/position-api";
import { getTest, type TestResponse } from "../lib/question-api";

type PositionTestRouteProps = {
  positionId: string;
};

export function PositionTestRoute({ positionId }: PositionTestRouteProps) {
  const [position, setPosition] = useState<PositionResponse | null>(null);
  const [test, setTest] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loadedPosition = await getPosition(positionId);
        if (cancelled) {
          return;
        }
        setPosition(loadedPosition);

        if (!loadedPosition.test) {
          setTest(null);
          return;
        }

        const loadedTest = await getTest(loadedPosition.test.id);
        if (!cancelled) {
          setTest(loadedTest);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load attached test");
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
  }, [positionId]);

  if (loading) {
    return (
      <section className="panel">
        <div className="stateCard">Loading attached test...</div>
      </section>
    );
  }

  if (error && !position) {
    return (
      <section className="panel">
        <div className="stateCard errorState">Error: {error}</div>
      </section>
    );
  }

  if (!position) {
    return (
      <section className="panel">
        <div className="stateCard">Position not found.</div>
      </section>
    );
  }

  if (!position.test) {
    return (
      <section className="panel">
        <div className="panelHeader">
          <div>
            <span className="sectionLabel">Position test</span>
            <h2>{position.title}</h2>
          </div>
          <p>This position does not have a test yet.</p>
        </div>

        <div className="stateCard emptyStateInline">Attach a new screening test to start collecting candidate attempts.</div>

        <Link className="primaryButton inlineButton" href={`/positions/${encodeURIComponent(position.id)}`}>
          Open position
        </Link>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <div className="stateCard errorState">Error: {error}</div>
      </section>
    );
  }

  if (!test) {
    return (
      <section className="panel">
        <div className="stateCard">Attached test not found.</div>
      </section>
    );
  }

  return (
    <section className="panel positionTestShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Position test</span>
          <h2>{position.title}</h2>
        </div>
        <p>
          {test.description ?? "No description"} Attached test status: {test.status}.
        </p>
      </div>

      <div className="pillRow">
        <span className="pill">{test.questions.length} questions</span>
        <span className="pill">{position.candidateCount} candidates</span>
        <span className="pill">{position.submittedCount} submitted</span>
      </div>

      <div className="detailCard">
        <strong>Attached test questions</strong>
        {test.questions.length === 0 ? (
          <div className="stateCard emptyStateInline">This test has no questions yet.</div>
        ) : (
          <ul className="dataList">
            {test.questions.map((question) => (
              <li key={question.id}>
                <strong>{question.order}. {question.title}</strong>
                <span>{question.type.replaceAll("_", " ")}</span>
                <small>{question.description ?? "No description"}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="positionActionStack">
        <Link className="primaryButton inlineButton" href={`/tests/${encodeURIComponent(test.id)}`}>
          Open candidate view
        </Link>
        <Link className="ghostButton inlineButton" href={`/positions/${encodeURIComponent(position.id)}`}>
          Back to position
        </Link>
      </div>
    </section>
  );
}
