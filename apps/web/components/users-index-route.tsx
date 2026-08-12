"use client";

import { useEffect, useState } from "react";
import { listUsers, type UserResponse, type UserRole } from "../lib/user-api";
import { UserSummaryCard } from "./user-summary-card";

type UsersIndexRouteProps = {
  role?: UserRole;
  title: string;
  description: string;
};

export function UsersIndexRoute({ role, title, description }: UsersIndexRouteProps) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await listUsers(role);
        if (!cancelled) {
          setUsers(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load users");
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
          <span className="sectionLabel">Users</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>

      {loading && <div className="stateCard">Loading users...</div>}
      {error && <div className="stateCard errorState">Error: {error}</div>}
      {!loading && !error && users.length === 0 && (
        <div className="stateCard emptyStateInline">No users have been created yet.</div>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="userGrid">
          {users.map((user) => (
            <UserSummaryCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </section>
  );
}
