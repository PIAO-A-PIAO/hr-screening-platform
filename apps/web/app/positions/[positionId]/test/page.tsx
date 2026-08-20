import type { Metadata } from "next";
import { PositionTestRoute } from "../../../../components/position-test-route";

export const metadata: Metadata = {
  title: "Position Test | DS-HR",
  description: "View or manage the test attached to a position",
};

type PositionTestPageProps = {
  params: Promise<{ positionId: string }>;
};

export default async function PositionTestPage({ params }: PositionTestPageProps) {
  const resolvedParams = await params;

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Position test</div>
        <h1>Attached test questions</h1>
        <p>Inspect the test linked to this position and jump back to the role record at any time.</p>
      </section>

      <PositionTestRoute positionId={resolvedParams.positionId} />
    </main>
  );
}
