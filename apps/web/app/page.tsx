import Link from "next/link";
import { api } from "../lib/api";
import { Job } from "../lib/types";

export default async function JobsPage() {
  let jobs: Job[] = [];
  let error = "";
  try {
    jobs = await api<Job[]>("/jobs");
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not reach the API";
  }

  return (
    <>
      <div className="pageHeader">
        <div><h1>Jobs</h1><p>Create an interview, invite candidates, and review every answer.</p></div>
        <Link className="button" href="/jobs/new">＋ New job</Link>
      </div>
      {error && <div className="error">{error}. Start PostgreSQL and the API using the README instructions.</div>}
      {!error && jobs.length === 0 && (
        <div className="card empty"><h3>No jobs yet</h3><p>Create your first job and interview template.</p></div>
      )}
      <div className="grid jobGrid">
        {jobs.map((job) => (
          <Link className="card jobCard" href={`/jobs/${job.id}`} key={job.id}>
            <div>
              <span className={`badge ${job.status === "DRAFT" ? "draft" : ""}`}>{job.status}</span>
              <h3>{job.title}</h3>
              <div className="metaRow"><span>{job.department}</span><span>{job.location || "Flexible"}</span></div>
            </div>
            <div className="stats">
              <div className="stat"><strong>{job.candidateCount ?? 0}</strong><small>Candidates</small></div>
              <div className="stat"><strong>{job.questionCount ?? 0}</strong><small>Questions</small></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
