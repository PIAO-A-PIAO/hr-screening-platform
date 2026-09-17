import type { Metadata } from "next";
import { InterviewReviewBridge } from "../../../../../components/interview-review-bridge";

export const metadata: Metadata = {
  title: "Review Interview | DS-HR",
  description: "Review a candidate interview response",
};

export default async function InterviewReviewPage({ params, searchParams }: {
  params: Promise<{ positionId: string; interviewId: string }>;
  searchParams?: Promise<{ status?: string }>;
}) {
  const { positionId, interviewId } = await params;
  const query = await searchParams;
  return (
    <main className="pageShell">
      <InterviewReviewBridge positionId={positionId} interviewId={interviewId} status={query?.status} />
    </main>
  );
}
