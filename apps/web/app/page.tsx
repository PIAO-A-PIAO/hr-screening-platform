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
        <Link className="routeCard" href="/questions">
          <span className="sectionLabel">Browse</span>
          <h2>See all questions</h2>
          <p>Open the question index and jump into the candidate answering view for any question.</p>
        </Link>
        <Link className="routeCard" href="/positions/create">
          <span className="sectionLabel">Test</span>
          <h2>Create a position and test</h2>
          <p>Start from a position record, then open the inline test panel to attach a screening flow.</p>
        </Link>
        <Link className="routeCard" href="/tests">
          <span className="sectionLabel">Browse</span>
          <h2>See all tests</h2>
          <p>Open the test index and launch the candidate answering flow for any created test.</p>
        </Link>
        <Link className="routeCard" href="/tests/take">
          <span className="sectionLabel">Candidate</span>
          <h2>Take a test with a token</h2>
          <p>Paste an invitation token and jump straight into the assigned candidate view.</p>
        </Link>
        <Link className="routeCard" href="/positions/create">
          <span className="sectionLabel">Positions</span>
          <h2>Create a position</h2>
          <p>Draft a role first, then optionally attach a screening test and start managing candidates.</p>
        </Link>
        <Link className="routeCard" href="/positions">
          <span className="sectionLabel">Positions</span>
          <h2>See all positions</h2>
          <p>Open the position index and review attached test state plus submitted candidate counts.</p>
        </Link>
        <Link className="routeCard" href="/video-recording">
          <span className="sectionLabel">Media</span>
          <h2>Browser video recording</h2>
          <p>Open the local recorder to test camera and microphone capture, preview, and download support.</p>
        </Link>
        <Link className="routeCard" href="/responses/create">
          <span className="sectionLabel">Responses</span>
          <h2>Submit a response</h2>
          <p>Save a typed candidate answer and upload a browser-recorded video when required.</p>
        </Link>
        <Link className="routeCard" href="/responses/view">
          <span className="sectionLabel">Responses</span>
          <h2>View a response</h2>
          <p>Retrieve a private response by ID using the matching candidate invitation token.</p>
        </Link>
        <Link className="routeCard" href="/users/create">
          <span className="sectionLabel">Users</span>
          <h2>Create a user</h2>
          <p>Open the recruiter-facing user form, or generate 10 sample users in one click.</p>
        </Link>
        <Link className="routeCard" href="/users/role/recruiter">
          <span className="sectionLabel">Users</span>
          <h2>Browse recruiters</h2>
          <p>Open the recruiter-only user feed and review summary cards for that role.</p>
        </Link>
        <Link className="routeCard" href="/users/role/candidate">
          <span className="sectionLabel">Users</span>
          <h2>Browse candidates</h2>
          <p>Open the candidate-only user feed and review summary cards for that role.</p>
        </Link>
      </section>
    </main>
  );
}
