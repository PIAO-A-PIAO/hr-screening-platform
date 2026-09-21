import type { Metadata } from "next";
import { ButtonLink } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";

export const metadata: Metadata = { title: "Configure Position | DS-HR" };
export default async function ConfigurePositionPage({ params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params;
  return <main className="pageShell"><PageHeader eyebrow="Position configuration" title="Configure position" description="Detailed position setup continues in P2-M08." actions={<ButtonLink href={`/positions/${encodeURIComponent(positionId)}`}>Open position</ButtonLink>} /><section className="panel"><div className="panelHeader"><div><span className="sectionLabel">P2-M08</span><h2>Configuration route is ready</h2></div><p>The route is reserved so P2-M05 cards do not lead to a missing page.</p></div></section></main>;
}
