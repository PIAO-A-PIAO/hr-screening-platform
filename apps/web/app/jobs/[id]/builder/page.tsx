import Link from "next/link";
import { InterviewBuilder } from "../../../../components/InterviewBuilder";
import { api } from "../../../../lib/api";
import { Job } from "../../../../lib/types";

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await api<Job>(`/jobs/${id}`);
  return (
    <>
      <div className="pageHeader">
        <div><h1>Interview builder</h1><p>{job.title} · weights determine the collective candidate score.</p></div>
        <Link className="button secondary" href={`/jobs/${job.id}`}>Back to job</Link>
      </div>
      <InterviewBuilder job={job} />
    </>
  );
}
