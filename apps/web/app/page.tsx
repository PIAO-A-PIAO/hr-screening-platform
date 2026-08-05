export const dynamic = "force-dynamic";

type ApiState = {
  connected: boolean;
  database: boolean;
  storage: boolean;
};

async function getApiState(): Promise<ApiState> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000/api";
  try {
    const response = await fetch(`${apiUrl}/health/ready`, { cache: "no-store" });
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
    <main>
      <section className="hero">
        <div className="eyebrow">DS-HR · Milestone 0</div>
        <h1>Clean foundation</h1>
        <p>
          The frontend, API, PostgreSQL connection, private storage, migrations,
          automated checks, and deployment scaffolding are ready for domain work.
        </p>
      </section>

      <section className="statusGrid" aria-label="Foundation status">
        <Status label="Frontend" ready />
        <Status label="API" ready={api.connected} />
        <Status label="PostgreSQL" ready={api.database} />
        <Status label="Private storage" ready={api.storage} />
      </section>

      <section className="emptyState">
        <span>Intentionally empty</span>
        <h2>No recruitment features or old data exist here.</h2>
        <p>
          Positions, interviews, questions, candidates, recordings, reviews, and
          L1–L4 workflow will be introduced deliberately in later milestones.
        </p>
      </section>
    </main>
  );
}
