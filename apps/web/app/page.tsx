export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";

type ApiState = {
  connected: boolean;
  database: boolean;
  storage: boolean;
};

async function getApiState(): Promise<ApiState> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") ?? "localhost:3000";
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
    const response = await fetch(`${protocol}://${host}/api/health/ready`, {
      cache: "no-store",
    });
    if (!response.ok) return { connected: true, database: false, storage: false };
    const data = await response.json() as {
      checks?: { database?: boolean; storage?: boolean };
    };
    return {
      connected: true,
      database: data.checks?.database === true,
      storage: data.checks?.storage === true,
    };
  } catch {
    return { connected: false, database: false, storage: false };
  }
}

function Status({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="statusCard">
      <span className={ready ? "dot ready" : "dot"} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <small>{ready ? "Ready" : "Not connected"}</small>
      </div>
    </div>
  );
}

export default async function Home() {
  const api = await getApiState();

  return (
    <main className="pageShell">
      <section className="hero">
        <div className="eyebrow">DS-HR - Screening questions</div>
        <h1>Question routes, not a dashboard</h1>
        <p>
          Use the dedicated create page or the dedicated view page. The homepage stays lightweight
          and only points you to the right route.
        </p>
      </section>

      <section className="statusGrid" aria-label="Foundation status">
        <Status label="Frontend" ready />
        <Status label="API" ready={api.connected} />
        <Status label="PostgreSQL" ready={api.database} />
        <Status label="Private storage" ready={api.storage} />
      </section>

      <section className="routeGrid" aria-label="Question routes">
        <Link className="routeCard" href="/questions/create">
          <span className="sectionLabel">Create</span>
          <h2>Create a screening question</h2>
          <p>Open the dedicated creation form for video, multiple choice, and short answer questions.</p>
        </Link>
        <Link className="routeCard" href="/questions/view">
          <span className="sectionLabel">View</span>
          <h2>View a question by ID</h2>
          <p>Open the dedicated lookup page and load a question, then inspect its details and media.</p>
        </Link>
        <Link className="routeCard" href="/tests/create">
          <span className="sectionLabel">Test</span>
          <h2>Create a test</h2>
          <p>Assemble ordered question drafts into one test record and save the bundle together.</p>
        </Link>
      </section>
    </main>
  );
}
