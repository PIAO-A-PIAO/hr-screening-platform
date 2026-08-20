import type { Metadata } from "next";
import { TakeTestRoute } from "../../../components/take-test-route";

export const metadata: Metadata = {
  title: "Take Test | DS-HR",
  description: "Open a candidate test from an invitation token",
};

export default function TakeTestPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Candidate</div>
        <h1>Take a test</h1>
        <p>Paste the invitation token you received, then open the assigned candidate view.</p>
      </section>

      <TakeTestRoute />
    </main>
  );
}
