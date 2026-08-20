import type { Metadata } from "next";
import { PositionDetailRoute } from "../../../components/position-detail-route";

export const metadata: Metadata = {
  title: "Position Detail | DS-HR",
  description: "View a position and its attached test",
};

type PositionPageProps = {
  params: Promise<{ positionId: string }>;
};

export default async function PositionDetailPage({ params }: PositionPageProps) {
  const resolvedParams = await params;

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Position detail</div>
        <h1>Position workflow</h1>
        <p>Review the role record, attached test state, candidate submissions, and pending invites in one place.</p>
      </section>

      <PositionDetailRoute positionId={resolvedParams.positionId} />
    </main>
  );
}
