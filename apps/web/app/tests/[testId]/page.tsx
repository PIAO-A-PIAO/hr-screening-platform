import type { Metadata } from "next";
import { TestAnswerRoute } from "../../../components/test-answer-route";

export const metadata: Metadata = {
  title: "Answer Test | DS-HR",
  description: "Open a candidate-facing test by ID",
};

type TestPageProps = {
  params: Promise<{
    testId: string;
  }>;
  searchParams: Promise<{
    inviteToken?: string;
  }>;
};

export default async function TestViewPage({ params, searchParams }: TestPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

 return (
    <TestAnswerRoute
      testId={resolvedParams.testId}
      inviteToken={resolvedSearchParams.inviteToken ?? ""}
    />
  );
}
