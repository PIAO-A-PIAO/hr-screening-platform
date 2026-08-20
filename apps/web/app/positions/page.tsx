import type { Metadata } from "next";
import Link from "next/link";
import { PositionsIndexRoute } from "../../components/positions-index-route";

export const metadata: Metadata = {
  title: "All Positions | DS-HR",
  description: "Browse all created positions",
};

export default function PositionsPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Positions</div>
        <h1>Browse positions</h1>
        <p>Track each role from draft to attached test, candidate invitations, and submitted attempts.</p>
        <div className="heroActions">
          <Link className="primaryButton inlineButton" href="/positions/create">
            Create position
          </Link>
        </div>
      </section>

      <PositionsIndexRoute />
    </main>
  );
}
