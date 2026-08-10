import type { Metadata } from "next";
import { QuestionCreateRoute } from "../../../components/question-create-route";

export const metadata: Metadata = {
  title: "Create Question | DS-HR",
  description: "Create a reusable screening question",
};

export default function CreateQuestionPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Questions</div>
        <h1>Create question</h1>
        <p>
          Build a reusable screening question with type-aware validation and media-ready storage links.
        </p>
      </section>

      <QuestionCreateRoute />
    </main>
  );
}
