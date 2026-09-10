"use client";

import { usePathname } from "next/navigation";
import { RecruiterShell } from "./recruiter-shell";

type ApplicationFrameProps = {
  children: React.ReactNode;
};

type PageContext = {
  title: string;
  eyebrow?: string;
};

function isCandidateRoute(pathname: string) {
  if (pathname === "/tests/take" || pathname.startsWith("/interview/")) return true;

  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "tests" && segments[1] !== "create";
}

function getPageContext(pathname: string): PageContext {
  if (pathname === "/") return { title: "Dashboard" };
  if (pathname === "/dev") return { title: "Development", eyebrow: "Internal tools" };
  if (pathname === "/positions/create") return { title: "Create position" };
  if (/^\/positions\/[^/]+\/test$/.test(pathname)) return { title: "Interview test" };
  if (/^\/positions\/[^/]+$/.test(pathname)) return { title: "Position details" };
  if (pathname.startsWith("/positions")) return { title: "Positions" };
  if (pathname === "/tests/create") return { title: "Create interview test" };
  if (pathname === "/tests") return { title: "Interview tests" };
  if (pathname === "/questions/create") return { title: "Create question" };
  if (pathname === "/questions/view") return { title: "Question details" };
  if (pathname.startsWith("/questions")) return { title: "Question bank" };
  if (pathname.startsWith("/email-templates")) return { title: "Email templates" };
  if (pathname.startsWith("/attempts")) return { title: "Candidate review" };
  if (pathname.startsWith("/users")) return { title: "Users" };
  if (pathname.startsWith("/responses")) return { title: "Responses" };
  if (pathname.startsWith("/video-recording")) return { title: "Video recording", eyebrow: "Internal tools" };
  return { title: "DS-HR" };
}

export function ApplicationFrame({ children }: ApplicationFrameProps) {
  const pathname = usePathname();

  if (isCandidateRoute(pathname)) return children;

  const context = getPageContext(pathname);
  return (
    <RecruiterShell title={context.title} eyebrow={context.eyebrow}>
      {children}
    </RecruiterShell>
  );
}
