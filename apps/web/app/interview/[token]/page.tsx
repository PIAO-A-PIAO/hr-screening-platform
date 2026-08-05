import { CandidateInterview } from "../../../components/CandidateInterview";
import { api } from "../../../lib/api";
import { Application } from "../../../lib/types";

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const application = await api<Application>(`/public/interviews/${token}`);
  return <CandidateInterview application={application} token={token} />;
}
