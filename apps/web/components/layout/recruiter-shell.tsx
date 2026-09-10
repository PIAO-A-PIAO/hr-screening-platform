import Link from "next/link";
import { RecruiterNav } from "./recruiter-nav";

type RecruiterShellProps = {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
};

export function RecruiterShell({ title, eyebrow = "Recruiting", children }: RecruiterShellProps) {
  return (
    <div className="recruiterApp">
      <aside className="recruiterSidebar">
        <Link className="recruiterBrand" href="/" aria-label="DS-HR dashboard">
          <span className="recruiterBrandMark" aria-hidden="true">DS</span>
          <span><strong>DS-HR</strong><small>Digital Shovel</small></span>
        </Link>
        <RecruiterNav />
      </aside>
      <div className="recruiterWorkspace">
        <header className="recruiterTopbar">
          <div><span>{eyebrow}</span><strong>{title}</strong></div>
          <div className="recruiterEnvironment">Internal workspace</div>
        </header>
        <div className="recruiterMain">{children}</div>
      </div>
    </div>
  );
}
