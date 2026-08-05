import { ReviewWorkspace } from "../../../components/ReviewWorkspace";
import { api } from "../../../lib/api";
import { Application } from "../../../lib/types";

export default async function ReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const application = await api<Application>(`/applications/${applicationId}/review`);
  return <ReviewWorkspace application={application} />;
}
