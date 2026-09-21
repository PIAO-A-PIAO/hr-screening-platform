import type { Metadata } from "next";
import { PositionDetailRoute } from "../../../components/position-detail-route";

export const metadata: Metadata = { title: "Candidate Pipeline | DS-HR", description: "Manage candidates for a position" };
const STATUS_BY_SLUG = { invited: "INVITED", "to-evaluate": "TO_EVALUATE", "phase-1": "PHASE_1", "phase-2": "PHASE_2", "phase-3": "PHASE_3", shortlisted: "PHASE_1", discarded: "DISCARDED" } as const;

export default async function PositionDetailPage({ params, searchParams }: {
  params: Promise<{ positionId: string }>;
  searchParams?: Promise<{ status?: string }>;
}) {
  const { positionId } = await params;
  const resolvedSearch = await searchParams;
  const initialStatus = STATUS_BY_SLUG[resolvedSearch?.status as keyof typeof STATUS_BY_SLUG] ?? "INVITED";
  return <main className="pageShell"><PositionDetailRoute positionId={positionId} initialStatus={initialStatus} /></main>;
}
