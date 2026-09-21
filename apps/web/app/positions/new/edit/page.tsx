import type { Metadata } from "next";
import { PositionEditRoute } from "../../../../components/position-edit-route";

export const metadata: Metadata = { title: "Create Position | DS-HR" };
export default function NewPositionPage() {
  return <PositionEditRoute />;
}
