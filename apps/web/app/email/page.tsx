import { EmailTemplateManager } from "../../components/email-template-manager";
import { PageHeader } from "../../components/ui/page-header";

export default function EmailPage() {
  return (
    <main className="pageShell">
      <PageHeader
        eyebrow="Communication"
        title="Email"
        description="Create and manage the reusable messages used across candidate invitations and reminders."
      />
      <EmailTemplateManager />
    </main>
  );
}
