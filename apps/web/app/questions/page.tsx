import type { Metadata } from "next";
import { QuestionsIndexRoute } from "../../components/questions-index-route";

export const metadata: Metadata = {
  title: "All Questions | DS-HR",
  description: "Browse all created questions",
};

export default function QuestionsPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Questions</div>
        <h1>Browse questions</h1>
        <p>Open any created question and jump into the candidate answering view.</p>
      </section>

      <QuestionsIndexRoute />
    </main>
  );
}
