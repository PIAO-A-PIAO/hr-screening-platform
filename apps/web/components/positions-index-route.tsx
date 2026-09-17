"use client";

import { useEffect, useState } from "react";
import { listPositions, type PositionSort, type PositionStatus, type PositionsPageResponse } from "../lib/position-api";
import { PositionSummaryCard } from "./position-summary-card";
import { Button, ButtonLink } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";
import { Pagination } from "./ui/pagination";
import { Tabs } from "./ui/tabs";

const EMPTY_PAGE: PositionsPageResponse = { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1, availableTags: [] };
const STATUSES: PositionStatus[] = ["OPEN", "DRAFT", "CLOSED"];

export function PositionsIndexRoute() {
  const [data, setData] = useState(EMPTY_PAGE);
  const [counts, setCounts] = useState<Record<PositionStatus, number>>({ OPEN: 0, DRAFT: 0, CLOSED: 0 });
  const [status, setStatus] = useState<PositionStatus>("OPEN");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<PositionSort>("CREATED_DESC");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [current, ...statusPages] = await Promise.all([
          listPositions({ status, search, tags, sort, page, pageSize: 10 }),
          ...STATUSES.map((entry) => listPositions({ status: entry, pageSize: 1 })),
        ]);
        if (cancelled) return;
        setData(current);
        setCounts({ OPEN: statusPages[0].total, DRAFT: statusPages[1].total, CLOSED: statusPages[2].total });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to load positions");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [page, reloadKey, search, sort, status, tags]);

  function selectStatus(next: PositionStatus) { setStatus(next); setTags([]); setPage(1); }
  function toggleTag(tag: string) { setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]); setPage(1); }
  function clearFilters() { setSearchInput(""); setSearch(""); setTags([]); setSort("CREATED_DESC"); setPage(1); }
  const hasFilters = searchInput !== "" || tags.length > 0 || sort !== "CREATED_DESC";

  return (
    <section className="positionsPanel" aria-labelledby="positions-list-title">
      <header className="positionsPanelHeader">
        <div><span className="positionsKicker">Position directory</span><h2 id="positions-list-title">All positions</h2></div>
        <p>Search positions by title, filter by tags, and open a position to manage its candidates.</p>
      </header>

      <div className="positionsToolbar">
        <label className="positionsSearch">
          <span>Search by title</span>
          <input type="search" value={searchInput} placeholder="Position title" onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <label className="positionsSelect">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value as PositionSort); setPage(1); }}>
            <option value="CREATED_DESC">Newest first</option><option value="CREATED_ASC">Oldest first</option><option value="TITLE_ASC">Title A–Z</option>
          </select>
        </label>
      </div>

      <div className="positionsStatusFilters">
        <Tabs label="Filter positions by status" items={STATUSES.map((entry) => ({ id: entry, label: entry === "OPEN" ? "Open" : entry === "DRAFT" ? "Draft" : "Closed", count: counts[entry] }))} activeId={status} onChange={(id) => selectStatus(id as PositionStatus)} />
      </div>

      {data.availableTags.length > 0 && (
        <div className="positionsTagFilters" aria-label="Filter by tags">
          <span>Tags</span>
          {data.availableTags.map((tag) => <button key={tag} type="button" className={tags.includes(tag) ? "positionTag isActive" : "positionTag"} aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</button>)}
        </div>
      )}

      <div className="positionsResultSummary" aria-live="polite">
        <span>{data.total} {data.total === 1 ? "position" : "positions"}</span>
        {hasFilters && <Button variant="ghost" size="small" onClick={clearFilters}>Clear filters</Button>}
      </div>

      {loading && <FeedbackState kind="loading" title="Loading positions" description="Retrieving the position directory." />}
      {!loading && error && <FeedbackState kind="error" title="Positions could not be loaded" description={error} actions={<Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>} />}
      {!loading && !error && data.items.length === 0 && (
        <FeedbackState kind="empty" title={hasFilters ? "No matching positions" : `No ${status.toLowerCase()} positions`} description={hasFilters ? "Clear the current filters and try again." : "Create a position to begin managing interviews."} actions={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : <ButtonLink href="/positions/new/edit">Create position</ButtonLink>} />
      )}
      {!loading && !error && data.items.length > 0 && (
        <><div className="positionsResults">{data.items.map((position) => <PositionSummaryCard key={position.id} position={position} onTagClick={toggleTag} onChanged={() => setReloadKey((key) => key + 1)} />)}</div>
        {data.totalPages > 1 && <div className="positionsPagination"><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} label="Position pages" /></div>}</>
      )}
    </section>
  );
}
