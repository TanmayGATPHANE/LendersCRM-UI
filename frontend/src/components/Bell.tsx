import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchEntries, fetchPartials } from "../api/client.ts";
import type { Entry, Payment } from "../api/types.ts";
import { daysBetween } from "../utils/interest.ts";

/** The header's attention bell (like the reference mock's red-dot bell):
    an active collateral that is over the horizon with no money back gets a
    notification — click it to jump the dashboard to that group. The rule:
    still Active (no release), zero partial returns, first lend 60+ days
    old. Counts ride on the plain entries + payments lists the whole app
    already reads; no money figures are computed here. */

/** "Out this long and never paid anything back" — the attention threshold. */
const STALE_DAYS = 60;

interface Notice {
  groupId: number;
  customerName: string;
  item: string;
  days: number;
}

export default function Bell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Outside click closes the dropdown.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Refresh with every navigation — returning from a release page drops
  // the noticed group from the list.
  useEffect(() => {
    let live = true;
    Promise.all([fetchEntries(), fetchPartials()])
      .then(([es, ps]: [Entry[], Payment[]]) => {
        if (!live) return;
        const today = new Date().toISOString().slice(0, 10);
        // Group-level: the group's first lend anchors the clock; any
        // partial return anywhere in the group clears it.
        const byGroup = new Map<number, {
          date: string; customerName: string; item: string; active: boolean;
        }>();
        for (const e of es) {
          const g = byGroup.get(e.groupId)
            ?? { date: e.date, customerName: e.customerName, item: e.item, active: false };
          g.active = g.active || e.status === "Active";
          if (e.date < g.date) {
            g.date = e.date;
            g.customerName = e.customerName;
            g.item = e.item;
          }
          byGroup.set(e.groupId, g);
        }
        const paid = new Set(ps.map((p) => p.groupId));
        if (!live) return;
        setNotices(
          [...byGroup]
            .filter(([gid, g]) => g.active && !paid.has(gid) && daysBetween(g.date, today) >= STALE_DAYS)
            .map(([gid, g]) => ({
              groupId: gid, customerName: g.customerName, item: g.item,
              days: daysBetween(g.date, today),
            }))
            .sort((a, b) => b.days - a.days) // the oldest loans first
        );
      })
      .catch(() => { /* the pages surface their own errors */ });
    return () => { live = false; };
  }, [location.pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => notices.length > 0 && setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-full text-slate hover:bg-tint"
        aria-label={`Notifications${notices.length ? ` (${notices.length})` : ""}`}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {notices.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-card py-1.5 shadow-[0_8px_30px_rgba(11,28,48,0.14)]">
          <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-dim">
            Needs attention
          </div>
          {notices.map((n) => (
            <button
              key={n.groupId}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                navigate("/", { state: { focusGroupId: n.groupId } });
              }}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-tint"
            >
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-tint text-slate">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{n.customerName} — {n.item}</span>
                <span className="block text-xs text-muted">
                  {n.days} days out · no return yet
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}