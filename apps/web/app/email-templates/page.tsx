import Link from "next/link";
import { EmailTemplateManager } from "../../components/email-template-manager";

export default function EmailTemplatesPage() {
  return (
    <main className="pageShell">
      <div className="hero compactHero">
        <Link className="sectionLabel" href="/">
          Back to home
        </Link>
        <h1>Global email templates</h1>
        <p>Manage reusable HTML and plain-text email content independently from position sequences.</p>
      </div>
      <EmailTemplateManager />
    </main>
  );
}
