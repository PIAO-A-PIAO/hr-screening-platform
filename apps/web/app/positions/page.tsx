import type { Metadata } from "next";
import { PositionsIndexRoute } from "../../components/positions-index-route";
import { AppIcon } from "../../components/ui/app-icon";
import { ButtonLink } from "../../components/ui/button";
import { PageHeader } from "../../components/ui/page-header";

export const metadata: Metadata = {
  title: "All Positions | DS-HR",
  description: "Browse all created positions",
};

export default function PositionsPage() {
  return (
    <main className="pageShell">
      <PageHeader
        eyebrow="Recruiting workspace"
        title="Positions"
        description="Manage open roles, monitor candidate activity, and keep every interview process moving."
        actions={
          <ButtonLink href="/positions/new/edit" leadingIcon={<AppIcon name="plus" size={18} />}>
            Create position
          </ButtonLink>
        }
      />

      <PositionsIndexRoute />
    </main>
  );
}
