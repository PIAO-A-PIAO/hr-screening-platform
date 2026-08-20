import type { Metadata } from "next";
import { PositionCreateRoute } from "../../../components/position-create-route";

export const metadata: Metadata = {
  title: "Create Position | DS-HR",
  description: "Create a position",
};

export default function CreatePositionPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Positions</div>
        <h1>Create position</h1>
        <p>Create the role first, then decide whether to attach a screening test immediately.</p>
      </section>

      <PositionCreateRoute />
    </main>
  );
}
