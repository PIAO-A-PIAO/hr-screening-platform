import type { Metadata } from "next";
import Link from "next/link";
import { ResponseViewRoute } from "../../../components/response-view-route";

export const metadata: Metadata = {
  title: "View Response | DS-HR",
  description: "Retrieve a private candidate response",
};

type ViewResponsePageProps = {
  searchParams?: Promise<{
    responseId?: string;
    inviteToken?: string;
  }>;
};

export default async function ViewResponsePage({
  searchParams,
}: ViewResponsePageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">
          DS-HR - Responses
        </div>

        <h1>View a candidate response</h1>

        <p>
          Retrieve one response by ID with the invitation token that
          authorized the submission.
        </p>

        <div className="heroActions">
          <Link
            className="ghostButton"
            href="/responses/create"
          >
            Create response
          </Link>
        </div>
      </section>

      <ResponseViewRoute
        initialResponseId={
          resolvedSearchParams?.responseId ?? ""
        }
        initialInviteToken={resolvedSearchParams?.inviteToken ?? ""}
      />
    </main>
  );
}
