import type { Metadata } from "next";
import Link from "next/link";
import { UsersIndexRoute } from "../../components/users-index-route";

export const metadata: Metadata = {
  title: "All Users | DS-HR",
  description: "Browse all users",
};

export default function UsersPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Users</div>
        <h1>Browse users</h1>
        <p>View every recruiter and candidate as a summary card in one place.</p>
        <div className="heroActions">
          <Link className="primaryButton inlineButton" href="/users/create">
            Create user
          </Link>
        </div>
      </section>

      <section className="routeGrid" aria-label="User role routes">
        <Link className="routeCard" href="/users/role/recruiter">
          <span className="sectionLabel">Role</span>
          <h2>Browse recruiters</h2>
          <p>Open the recruiter-only user feed and review summary cards for that role.</p>
        </Link>
        <Link className="routeCard" href="/users/role/candidate">
          <span className="sectionLabel">Role</span>
          <h2>Browse candidates</h2>
          <p>Open the candidate-only user feed and review summary cards for that role.</p>
        </Link>
      </section>

      <UsersIndexRoute
        title="All users"
        description="Each card is read-only and shows the user summary directly in the list."
      />
    </main>
  );
}
