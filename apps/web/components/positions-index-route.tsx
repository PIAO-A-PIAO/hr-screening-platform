"use client";

import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionStatus, type PositionSummaryResponse } from "../lib/position-api";
import { PositionSummaryCard } from "./position-summary-card";
import { AppIcon } from "./ui/app-icon";
import { Button, ButtonLink } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";
import { Pagination } from "./ui/pagination";
import { Tabs } from "./ui/tabs";

type StatusFilter = "ALL" | PositionStatus;
type TestFilter = "ALL" | "WITH_TEST" | "NO_TEST" | "PUBLISHED";
type SortOption = "UPDATED_DESC" | "CREATED_DESC" | "TITLE_ASC" | "CANDIDATES_DESC";

const PAGE_SIZE = 8;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function PositionsIndexRoute() {
  const [positions, setPositions] = useState<PositionSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [testFilter, setTestFilter] = useState<TestFilter>("ALL");
  const [sort, setSort] = useState<SortOption>("UPDATED_DESC");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await listPositions();
        if (!cancelled) {
          setPositions(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load positions");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [search, status, testFilter, sort]);

  const metrics = useMemo(() => ({
    total: positions.length,
    open: positions.filter((position) => position.status === "OPEN").length,
    candidates: positions.reduce((total, position) => total + position.candidateCount, 0),
    submitted: positions.reduce((total, position) => total + position.submittedCount, 0),
  }), [positions]);

  const statusTabs = useMemo(() => {
    const count = (target: PositionStatus) => positions.filter((position) => position.status === target).length;
    return [
      { id: "ALL", label: "All", count: positions.length },
      { id: "OPEN", label: "Open", count: count("OPEN") },
      { id: "DRAFT", label: "Draft", count: count("DRAFT") },
      { id: "ON_HOLD", label: "On hold", count: count("ON_HOLD") },
      { id: "CLOSED", label: "Closed", count: count("CLOSED") },
    ];
  }, [positions]);

  const filteredPositions = useMemo(() => {
    const query = normalized(search);
    const matches = positions.filter((position) => {
      const searchable = [position.title, position.description ?? "", position.department, position.location, position.owner]
        .join(" ")
        .toLocaleLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus = status === "ALL" || position.status === status;
      const matchesTest = testFilter === "ALL"
        || (testFilter === "WITH_TEST" && position.test !== null)
        || (testFilter === "NO_TEST" && position.test === null)
        || (testFilter === "PUBLISHED" && position.testState === "PUBLISHED");
      return matchesSearch && matchesStatus && matchesTest;
    });

    return [...matches].sort((left, right) => {
      if (sort === "TITLE_ASC") return left.title.localeCompare(right.title);
      if (sort === "CANDIDATES_DESC") return right.candidateCount - left.candidateCount || left.title.localeCompare(right.title);
      if (sort === "CREATED_DESC") return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
  }, [positions, search, sort, status, testFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPositions.length / PAGE_SIZE));
  const visiblePositions = filteredPositions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search.trim() !== "" || status !== "ALL" || testFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setTestFilter("ALL");
  }

  return (
    <div className="positionsDashboard">
      {!loading && !error && (
        <section className="positionsMetrics" aria-label="Position summary">
          <article className="positionsMetric">
            <span className="positionsMetricIcon"><AppIcon name="briefcase" /></span>
            <span>Total positions</span>
            <strong>{metrics.total}</strong>
            <small>Across every hiring status</small>
          </article>
          <article className="positionsMetric">
            <span className="positionsMetricIcon"><AppIcon name="published" /></span>
            <span>Open roles</span>
            <strong>{metrics.open}</strong>
            <small>Currently accepting candidates</small>
          </article>
          <article className="positionsMetric">
            <span className="positionsMetricIcon"><AppIcon name="people" /></span>
            <span>Candidates</span>
            <strong>{metrics.candidates}</strong>
            <small>Assigned across all positions</small>
          </article>
          <article className="positionsMetric">
            <span className="positionsMetricIcon"><AppIcon name="review" /></span>
            <span>Submitted</span>
            <strong>{metrics.submitted}</strong>
            <small>Completed interview attempts</small>
          </article>
        </section>
      )}

      {loading && <FeedbackState kind="loading" title="Loading positions" description="Retrieving the latest position and candidate totals." />}

      {!loading && error && (
        <FeedbackState
          kind="error"
          title="Positions could not be loaded"
          description={error}
          actions={<Button variant="secondary" onClick={() => setReloadKey((current) => current + 1)}>Try again</Button>}
        />
      )}

      {!loading && !error && positions.length === 0 && (
        <FeedbackState
          kind="empty"
          title="Create your first position"
          description="Positions will appear here with their test readiness and candidate activity."
          actions={<ButtonLink href="/positions/create" leadingIcon={<AppIcon name="plus" size={18} />}>Create position</ButtonLink>}
        />
      )}

      {!loading && !error && positions.length > 0 && (
        <section className="positionsPanel" aria-labelledby="positions-list-title">
          <header className="positionsPanelHeader">
            <div>
              <span className="positionsKicker">Position directory</span>
              <h2 id="positions-list-title">All positions</h2>
            </div>
            <p>Search and filter roles, then open a position to manage its interview and candidates.</p>
          </header>

          <div className="positionsToolbar">
            <label className="positionsSearch">
              <span>Search positions</span>
              <input
                type="search"
                value={search}
                placeholder="Title, department, location or owner"
                aria-controls="positions-results"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="positionsSelect">
              <span>Test</span>
              <select value={testFilter} onChange={(event) => setTestFilter(event.target.value as TestFilter)}>
                <option value="ALL">All test states</option>
                <option value="WITH_TEST">Test attached</option>
                <option value="PUBLISHED">Published test</option>
                <option value="NO_TEST">No test</option>
              </select>
            </label>
            <label className="positionsSelect">
              <span>Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
                <option value="UPDATED_DESC">Recently updated</option>
                <option value="CREATED_DESC">Recently created</option>
                <option value="TITLE_ASC">Position title</option>
                <option value="CANDIDATES_DESC">Most candidates</option>
              </select>
            </label>
          </div>

          <div className="positionsStatusFilters">
            <Tabs label="Filter positions by status" items={statusTabs} activeId={status} onChange={(id) => setStatus(id as StatusFilter)} />
          </div>

          <div className="positionsResultSummary" aria-live="polite">
            <span>{filteredPositions.length} {filteredPositions.length === 1 ? "position" : "positions"}</span>
            {hasFilters && <Button variant="ghost" size="small" onClick={clearFilters}>Clear filters</Button>}
          </div>

          {filteredPositions.length === 0 ? (
            <FeedbackState
              kind="empty"
              title="No positions match these filters"
              description="Adjust your search or clear the current filters to see all positions."
              actions={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <>
              <div className="positionsResults" id="positions-results">
                {visiblePositions.map((position) => <PositionSummaryCard key={position.id} position={position} />)}
              </div>
              {totalPages > 1 && (
                <div className="positionsPagination">
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} label="Position pages" />
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
