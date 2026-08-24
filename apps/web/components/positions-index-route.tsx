"use client";

import { useEffect, useState } from "react";
import { listPositions, type PositionSummaryResponse } from "../lib/position-api";
import { PositionSummaryCard } from "./position-summary-card";

export function PositionsIndexRoute() {
  const [positions, setPositions] = useState<PositionSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Positions</span>
          <h2>All positions</h2>
        </div>
        <p>Each card reflects the attached test state and assignment counts stored on the test records.</p>
      </div>

      {loading && <div className="stateCard">Loading positions...</div>}
      {error && <div className="stateCard errorState">Error: {error}</div>}
      {!loading && !error && positions.length === 0 && (
        <div className="stateCard emptyStateInline">No positions have been created yet.</div>
      )}

      {!loading && !error && positions.length > 0 && (
        <div className="positionGrid">
          {positions.map((position) => (
            <PositionSummaryCard key={position.id} position={position} />
          ))}
        </div>
      )}
    </section>
  );
}
