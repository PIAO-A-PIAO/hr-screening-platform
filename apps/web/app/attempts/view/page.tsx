import type { Metadata } from "next";
import { AttemptViewRoute } from "../../../components/attempt-view-route";

export const metadata: Metadata = {
  title: "View Attempt | DS-HR",
  description: "Retrieve a private candidate attempt",
};

type ViewAttemptPageProps = {
  searchParams?: Promise<{
    attemptId?: string;
    inviteToken?: string;
  }>;
};

export default async function ViewAttemptPage({
  searchParams,
}: ViewAttemptPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Attempts</div>
        <h1>View a candidate attempt</h1>
        <p>Retrieve one submitted attempt by ID with the invitation token that authorized it.</p>
      </section>

      <AttemptViewRoute
        initialAttemptId={resolvedSearchParams?.attemptId ?? ""}
        initialInviteToken={resolvedSearchParams?.inviteToken ?? ""}
      />
    </main>
  );
}
