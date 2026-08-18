import type { Metadata } from "next";
import { TestsIndexRoute } from "../../components/tests-index-route";

export const metadata: Metadata = {
  title: "All Tests | DS-HR",
  description: "Browse all created tests",
};

export default function TestsPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Tests</div>
        <h1>Browse tests</h1>
        <p>Open any created test and step through the candidate answering flow.</p>
      </section>

      <TestsIndexRoute />
    </main>
  );
}
