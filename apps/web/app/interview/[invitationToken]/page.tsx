import { CandidateWelcome } from "../../../components/candidate-welcome";

export default async function Page({ params }: { params: Promise<{ invitationToken: string }> }) {
  const { invitationToken } = await params;
  return <CandidateWelcome invitationToken={invitationToken} />;
}
