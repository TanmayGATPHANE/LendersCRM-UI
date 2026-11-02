import { useEffect, useMemo, useState } from "react";
import { fetchActivity, fetchUsers } from "../api/client.ts";
import type { ActivityItem, UserItem } from "../api/types.ts";
import { LoadMore, useChunkedRows } from "../components/LoadMore.tsx";
import { selectCls } from "../components/ui.ts";

/**
 * Activity — the audit trail (§10), Admin only: every add, edit, partial
 * return, release, cash movement and account change the system has
 * recorded, newest first. Each row says WHO did it (the name was
 * snapshotted at write time), WHEN, and a plain sentence about WHAT moved.
 * The dropdown narrows it to one user's trail.
 */

/** Chip color per action verb — red stays reserved for deletions. */
const ACTION_CLS: Record<string, string> = {
  Created: "bg-tint text-green-700",
  Updated: "bg-tint text-slate",
  Released: "bg-tint text-primary",
  Deleted: "bg-tint text-red-600",
};

/** When a row happened — local date and clock time ("02 Nov, 4:10 pm"). */
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit",
  });
}

export default function Activity() {
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userId, setUserId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // The trail refetches whenever the user filter changes; one admin-only
  // endpoint serves the whole row and the filter is a query param.
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchActivity(userId === "all" ? undefined : Number(userId))
      .then((r) => { if (live) setRows(r); })
      .catch(() => { if (live) setRows([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [userId]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => { /* the trail itself still shows */ });
  }, []);

  // Paged rendering — 50 rows at a time (scroll or "Show more"), like the
  // other long tables.
  const [visible, more] = useChunkedRows(rows.length);
  const page = useMemo(() => rows.slice(0, visible), [rows, visible]);

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Toolbar: the who-filter on the left, the count on the right */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <h1 className="text-lg font-semibold text-ink">User Activity</h1>
        <select value={userId} onChange={(e) => setUserId(e.target.value)}
                title="Show one user's trail" className={selectCls}>
          <option value="all">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-sm text-muted">
          {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "event" : "events"}`}
        </span>
      </div>

      {/* The trail — paged like every other long table */}
      <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        {/* Mobile: one card per event */}
        <div className="stagger space-y-2 p-3 md:hidden">
          {page.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_CLS[r.action] ?? "bg-tint text-slate"}`}>
                    {r.action}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{r.userName}</span>
                  <span className="mt-0.5 block text-xs text-muted">{when(r.atUtc)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate">{r.details}</p>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              Nothing recorded yet — actions land here as the books change.
            </p>
          )}
        </div>

        <table className="hidden table-fixed w-full min-w-[720px] text-sm md:table">
          <thead className="sticky top-0 z-10 bg-card border-b border-line">
            <tr>
              <th className={`${th} w-[19%]`}>When</th>
              <th className={`${th} w-[18%]`}>User</th>
              <th className={`${th} w-[13%]`}>Action</th>
              <th className={`${th} w-[50%]`}>What changed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {page.map((r) => (
              <tr key={r.id} className="hover:bg-tint even:bg-tint/40">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate">{when(r.atUtc)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate">{r.userName}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_CLS[r.action] ?? "bg-tint text-slate"}`}>
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate">{r.details}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="hidden px-3 py-12 text-center text-sm text-muted md:table-cell">
                  Nothing recorded yet — actions land here as the books change.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <LoadMore visible={visible} total={rows.length} onMore={more} />
      </div>
    </main>
  );
}

