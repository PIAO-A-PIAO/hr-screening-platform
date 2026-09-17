import type { Metadata } from "next";
import { PositionCreateRoute } from "../../../../components/position-create-route";
import { PageHeader } from "../../../../components/ui/page-header";

export const metadata: Metadata = { title: "Create Position | DS-HR" };
export default function NewPositionPage() {
  return <main className="pageShell"><PageHeader eyebrow="Positions" title="Create position" description="Add a position to the recruiting workspace." /><PositionCreateRoute /></main>;
}
