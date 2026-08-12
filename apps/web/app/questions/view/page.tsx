import type { Metadata } from "next";
import { QuestionAnswerRoute } from "../../../components/question-answer-route";

export const metadata: Metadata = {
  title: "Answer Question | DS-HR",
  description: "Open a candidate-facing question view by ID",
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
        <h1>Answer question</h1>
        <p>
          Load a question by ID and use the candidate answering experience instead of the recruiter detail view.
        </p>
      </section>

      <QuestionAnswerRoute initialQuestionId={resolvedSearchParams?.questionId ?? ""} />
    </main>
  );
}
