import type { Metadata } from "next";
import { PositionEditRoute } from "../../../../components/position-edit-route";

export const metadata: Metadata = { title: "Configure Position | DS-HR" };
export default async function ConfigurePositionPage({ params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params;
  return <PositionEditRoute initialPositionId={positionId} />;
}
