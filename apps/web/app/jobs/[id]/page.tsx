import Link from "next/link";
import { AddCandidateForm } from "../../../components/AddCandidateForm";
import { api, browserApiUrl } from "../../../lib/api";
import { Job } from "../../../lib/types";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await api<Job>(`/jobs/${id}`);
  return (
    <>
      <div className="pageHeader">
        <div>
          <div className="metaRow"><span className={`badge ${job.status === "DRAFT" ? "draft" : ""}`}>{job.status}</span><span>{job.department}</span><span>{job.location || "Flexible"}</span></div>
          <h1>{job.title}</h1><p>{job.description}</p>
        </div>
        <Link className="button secondary" href={`/jobs/${job.id}/builder`}>Edit interview</Link>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Invite a candidate</h3>
        <AddCandidateForm jobId={job.id} disabled={!job.template?.isPublished} />
        {!job.template?.isPublished && <p className="metaRow">Publish the interview before inviting candidates.</p>}
      </div>

      <div className="pageHeader"><div><h2>Candidates</h2><p>Collective weighted ratings appear after reviews are submitted.</p></div></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Candidate</th><th>Status</th><th>Score</th><th>Invitation</th><th></th></tr></thead>
          <tbody>
            {(job.applications ?? []).map((application) => (
              <tr key={application.id}>
                <td><strong>{application.candidate.firstName} {application.candidate.lastName}</strong><br /><small>{application.candidate.email}</small></td>
                <td>{application.status}</td>
                <td><span className="score">{application.collectiveScore == null ? "—" : `${application.collectiveScore}/5`}</span></td>
                <td><div className="copyText">{`${browserApiUrl.replace(/\/api$/, "").replace(":4000", ":3000")}/interview/${application.inviteToken}`}</div></td>
                <td>{application.submittedAt && <Link className="button secondary" href={`/review/${application.id}`}>Review</Link>}</td>
              </tr>
            ))}
            {!job.applications?.length && <tr><td colSpan={5} className="empty">No candidates invited yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
