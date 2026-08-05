import Link from "next/link";
import { NewJobForm } from "../../../components/NewJobForm";

export default function NewJobPage() {
  return (
    <div className="panel">
      <div className="pageHeader">
        <div><h1>Create a job</h1><p>The interview template is created automatically.</p></div>
        <Link className="button secondary" href="/">Cancel</Link>
      </div>
      <div className="card"><NewJobForm /></div>
    </div>
  );
}
