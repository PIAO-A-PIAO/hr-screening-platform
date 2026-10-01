"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Summary = {
  candidateName: string;
  roleName: string;
  testName: string;
  totalQuestions: number;
  submittedQuestions: number;
  submitted: boolean;
};

export function CandidateWelcome({
  invitationToken,
}: {
  invitationToken: string;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(
      `/api/attempts/invite/${encodeURIComponent(
        invitationToken,
      )}/welcome`,
    )
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json()) as {
            message?: string;
          };

          throw new Error(
            payload.message ?? "Unable to open invitation",
          );
        }

        return response.json() as Promise<Summary>;
      })
      .then(setData)
      .catch((caught: Error) => {
        setError(caught.message);
      });
  }, [invitationToken]);

  if (error) {
    return (
      <main className="pageShell">
        <div className="stateCard errorState">
          {error}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="pageShell">
        <div className="stateCard">
          Loading invitation…
        </div>
      </main>
    );
  }

  const completed = data.submitted;

  const inProgress =
    data.submittedQuestions > 0 && !completed;

  return (
    <main className="pageShell candidateWelcome">
      <section className="panel candidateWelcomePanel">
        <span className="sectionLabel">
          {data.roleName}
        </span>

        {completed ? (
          <>
            <h1>
              Thank you, {data.candidateName}!
            </h1>

            <p>
              You’ve completed your interview for the{" "}
              <strong>{data.roleName}</strong> position.
            </p>
          </>
        ) : inProgress ? (
          <>
            <h1>
              Welcome back, {data.candidateName}!
            </h1>

            <p>
              You’ve completed {data.submittedQuestions} of{" "}
              {data.totalQuestions} questions. Pick up where
              you left off when you’re ready.
            </p>

            <Link
              className="primaryButton"
              href={`/interview/${encodeURIComponent(
                invitationToken,
              )}/device`}
            >
              Continue Interview
            </Link>
          </>
        ) : (
          <>
            <h1>
              Welcome, {data.candidateName}!
            </h1>

            <p>
              You’ve been invited to complete{" "}
              <strong>{data.testName}</strong> for the{" "}
              <strong>{data.roleName}</strong> position.
            </p>

            <p className="helperText">
              Before you begin, we’ll quickly check your
              camera and microphone to make sure everything
              is ready.
            </p>

            <Link
              className="primaryButton"
              href={`/interview/${encodeURIComponent(
                invitationToken,
              )}/device`}
            >
              Get Started
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
