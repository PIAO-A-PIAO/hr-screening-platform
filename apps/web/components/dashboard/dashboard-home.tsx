"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionSummaryResponse } from "../../lib/position-api";
import { ActionLink } from "../ui/action-link";
import { AppIcon } from "../ui/app-icon";

type MetricProps = {
  label: string;
  value: number;
  helper: string;
  icon: "briefcase" | "people" | "review" | "published";
};

function Metric({ label, value, helper, icon }: MetricProps) {
  return (
    <article className="dashboardMetric">
      <div className="dashboardMetricIcon"><AppIcon name={icon} /></div>
      <span>{label}</span><strong>{value}</strong><small>{helper}</small>
    </article>
  );
}

function statusLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(value));
}

export function DashboardHome() {
  const [positions, setPositions] = useState<PositionSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all(["OPEN", "CLOSED"].map((status) => listPositions({ status: status as "OPEN" | "CLOSED", pageSize: 100 })))
      .then((result) => { if (!cancelled) setPositions(result.flatMap((page) => page.items)); })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Dashboard data could not be loaded"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const open = positions.filter((position) => position.status === "OPEN");
    return {
      openPositions: open.length,
      activeCandidates: open.reduce((total, position) => total + position.candidateCount, 0),
      submittedInterviews: open.reduce((total, position) => total + position.submittedCount, 0),
      publishedTests: open.filter((position) => position.testState === "PUBLISHED").length,
    };
  }, [positions]);

  const recentPositions = useMemo(() => [...positions]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 5), [positions]);

  const attentionItems = useMemo(() => [
    { label: "Open positions without a published test", count: positions.filter((position) => position.status === "OPEN" && position.testState !== "PUBLISHED").length, href: "/positions" },
    { label: "Candidates to evaluate", count: positions.reduce((total, position) => total + position.workflowCounts.TO_EVALUATE, 0), href: "/positions" },
  ], [positions]);

  return (
    <>
      <section className="dashboardHeading">
        <div><span className="dashboardKicker">Hiring overview</span><h1>Dashboard</h1><p>See the current recruitment workload and continue where attention is needed.</p></div>
        <ActionLink href="/positions/new/edit">Create position</ActionLink>
      </section>
      {loading && <div className="dashboardNotice">Loading hiring overview…</div>}
      {error && <div className="dashboardNotice dashboardNoticeError">Unable to load dashboard: {error}</div>}
      {!loading && !error && (
        <>
          <section className="dashboardMetrics" aria-label="Hiring summary">
            <Metric label="Open positions" value={summary.openPositions} helper="Currently accepting candidates" icon="briefcase" />
            <Metric label="Active candidates" value={summary.activeCandidates} helper="Across open positions" icon="people" />
            <Metric label="Submitted interviews" value={summary.submittedInterviews} helper="Recorded submissions" icon="review" />
            <Metric label="Published tests" value={summary.publishedTests} helper="Ready for invitations" icon="published" />
          </section>
          <div className="dashboardGrid">
            <section className="dashboardPanel dashboardPositionsPanel">
              <header className="dashboardPanelHeader">
                <div><span>Recently updated</span><h2>Positions</h2></div>
                <ActionLink href="/positions" variant="secondary" arrow>View all</ActionLink>
              </header>
              {recentPositions.length === 0 ? (
                <div className="dashboardEmpty"><strong>No positions yet</strong><span>Create the first position to begin the hiring workflow.</span></div>
              ) : (
                <div className="dashboardPositionList">
                  {recentPositions.map((position) => (
                    <Link href={`/positions/${encodeURIComponent(position.id)}`} key={position.id}>
                      <div className="dashboardPositionIdentity"><strong>{position.title}</strong><span>{position.departments.map((department) => department.name).join(" · ") || "No department"}</span></div>
                      <div className="dashboardPositionNumbers"><span><strong>{position.candidateCount}</strong> candidates</span><span><strong>{position.submittedCount}</strong> submitted</span></div>
                      <span className={`dashboardStatus dashboardStatus-${position.status.toLowerCase()}`}>{statusLabel(position.status)}</span>
                      <span className="dashboardUpdated">{formatDate(position.updatedAt)}</span>
                      <AppIcon name="arrow" size={17} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <aside className="dashboardPanel dashboardAttentionPanel">
              <header className="dashboardPanelHeader"><div><span>Operational checks</span><h2>Attention</h2></div></header>
              <div className="dashboardAttentionList">
                {attentionItems.map((item) => <Link href={item.href} key={item.label}><span>{item.label}</span><strong>{item.count}</strong></Link>)}
              </div>
              <p>Counts are calculated from the existing position and test records.</p>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
