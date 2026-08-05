"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const candidateMode = usePathname().startsWith("/interview/");
  if (candidateMode) {
    return <main style={{ padding: "30px 16px" }}>{children}</main>;
  }
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/"><span className="brandMark">I</span> Interview Desk</Link>
        <div className="userPill"><span>RG</span><div><strong>Richik</strong><small>Recruiter · Demo</small></div></div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <nav>
            <Link href="/" className="navItem active">▦ <span>Jobs</span></Link>
            <span className="navItem muted">◉ <span>Candidates</span></span>
            <span className="navItem muted">⌁ <span>Analytics</span></span>
          </nav>
          <p className="demoNotice">MVP mode<br /><small>Authentication uses seeded demo users.</small></p>
        </aside>
        <main className="content">{children}</main>
      </div>
    </>
  );
}
