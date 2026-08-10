import type { Metadata } from "next";
import { QuestionViewer } from "../../../components/question-viewer";

export const metadata: Metadata = {
  title: "View Question | DS-HR",
  description: "View a reusable screening question by ID",
};

type ViewQuestionPageProps = {
  searchParams?: Promise<{
    questionId?: string;
  }>;
};

export default async function ViewQuestionPage({ searchParams }: ViewQuestionPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Questions</div>
        <h1>View question</h1>
        <p>
          Load a question by ID, inspect its structured item payload, and preview attached media.
        </p>
      </section>

      <QuestionViewer initialQuestionId={resolvedSearchParams?.questionId ?? ""} />
    </main>
  );
}
