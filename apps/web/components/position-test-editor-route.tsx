"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPosition, type PositionResponse } from "../lib/position-api";
import { CreateTestPanel } from "./create-test-panel";

export function PositionTestEditorRoute({ positionId, testId }: { positionId: string; testId: string }) {
  const [position, setPosition] = useState<PositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getPosition(positionId).then((loaded) => {
      if (cancelled) return;
      if (testId !== "new" && loaded.test?.id !== testId) throw new Error("This test is not attached to the selected position.");
      if (testId === "new" && loaded.test) throw new Error("This position already has an attached test.");
      setPosition(loaded);
    }).catch((caught) => !cancelled && setError(caught instanceof Error ? caught.message : "Failed to load position test"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [positionId, testId]);
  return <main className="pageShell"><Link className="ghostButton inlineButton" href={`/positions/${encodeURIComponent(positionId)}/edit`}>Back to position settings</Link>
    {loading && <div className="stateCard">Loading test editor...</div>}{error && <div className="stateCard errorState">Error: {error}</div>}{position && <CreateTestPanel position={position} />}
  </main>;
}
