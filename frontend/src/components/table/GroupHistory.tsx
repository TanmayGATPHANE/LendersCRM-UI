import { useState } from "react";
import { fetchActivity, isAdmin } from "../../api/client.ts";
import type { ActivityItem } from "../../api/types.ts";

/**
 * GroupHistory — the audit trail of ONE collateral group (§10), shown
 * inside the expanded row's detail panel (and the mobile card). Renders as
 * a small "History" toggle with a clock icon; opening it pulls the
 * group's rows from the Admin-only activity endpoint and lists them:
 * who added each lend, who edited or corrected what, who released.
 * Admin only — the component renders nothing for other roles, and the
 * endpoint backs that up server-side.
 */

/** Chip color per action verb (same scheme the Activity page uses). */
const ACTION_CLS: Record<string, string> = {
  Created: "text-green-700",
  Updated: "text-slate",
  Released: "text-primary",
  Deleted: "text-red-600",
};

/** When — local day + clock time ("02 Nov, 4:10 pm"). */
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit",
  });
}

export default function GroupHistory({ groupId }: { groupId: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState("");

  if (!isAdmin()) return null; // the trail is the Admin's view

  /** First open pulls the group's trail; later opens reuse it. */
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      try {
        setRows(await fetchActivity(undefined, groupId));
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line
                   bg-card px-2.5 py-1 text-xs text-primary transition-colors duration-300 ease-brand
                   hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        title="See who added and who edited this collateral"
      >
        <i className="ph ph-clock-counter-clockwise text-sm" aria-hidden="true" />
        History
      </button>
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-line bg-card">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full cursor-pointer items-center gap-1.5 border-b border-line px-2.5 py-1.5 text-xs
                   font-medium text-slate hover:bg-tint transition-colors duration-300 ease-brand
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        title="Hide this history"
      >
        <i className="ph ph-clock-counter-clockwise text-sm text-primary" aria-hidden="true" />
        History
        <i className="ph ph-caret-up ml-auto text-sm text-dim" aria-hidden="true" />
      </button>
      <ul className="divide-y divide-line">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex items-start gap-2 px-2.5 py-1.5 text-xs">
            <span className={`shrink-0 font-medium ${ACTION_CLS[r.action] ?? "text-slate"}`}>
              {r.action}
            </span>
            <span className="min-w-0 flex-1 text-slate">
              {r.details}
              <span className="ml-1 whitespace-nowrap text-muted">
                — {r.userName}, {when(r.atUtc)}
              </span>
            </span>
          </li>
        ))}
        {rows !== null && rows.length === 0 && (
          <li className="px-2.5 py-2 text-xs text-muted">
            No recorded changes — this collateral predates the activity log.
          </li>
        )}
        {rows === null && (
          <li className="px-2.5 py-2 text-xs text-muted">
            {error ? error : "Loading…"}
          </li>
        )}
      </ul>
    </div>
  );
}

