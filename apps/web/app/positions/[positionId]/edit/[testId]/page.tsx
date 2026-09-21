import type { Metadata } from "next";
import { PositionTestEditorRoute } from "../../../../../components/position-test-editor-route";

export const metadata: Metadata = { title: "Edit Position Test | DS-HR" };
export default async function EditPositionTestPage({ params }: { params: Promise<{ positionId: string; testId: string }> }) {
  const { positionId, testId } = await params;
  return <PositionTestEditorRoute positionId={positionId} testId={testId} />;
}
