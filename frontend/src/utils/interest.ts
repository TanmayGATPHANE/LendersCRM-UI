// Interest rules from notes/requirements-plan.md §4.4.
//
// One implementation used by the Dashboard table, the summary card and the
// release dialog: interest accrues from the date of lend at a rate quoted
// per month, so a partial month counts as daysSinceLend / 30.

import type { Entry } from "../api/types.ts";

const DAY = 24 * 60 * 60 * 1000;

/** Whole days between two ISO date strings (yyyy-mm-dd). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00").getTime();
  const to = new Date(toIso + "T00:00:00").getTime();
  return Math.max(0, Math.round((to - from) / DAY));
}

/**
 * Interest accrued on an entry from its lend date up to `asOf` (default today).
 * rate may be null/0 — then interest is 0. The accrual basis is the entry's
 * outstanding principal: `amount − paid`, where `paid` is attached by the
 * Dashboard using utils/repayment.ts — partial returns already collected
 * come off the principal this interest runs on.
 */
export function accruedInterest(
  entry: Pick<Entry, "amount" | "rate" | "date"> & { paid?: number },
  asOf: string = new Date().toISOString().slice(0, 10)
): number {
  const basis = entry.amount - (entry.paid ?? 0);
  if (!entry.rate || basis <= 0) return 0;
  const days = daysBetween(entry.date, asOf);
  const raw = basis * (entry.rate / 100) * (days / 30);
  return Math.round(raw);
}

/** The interest value to display for an entry — the BACKEND's figure
    (entry.interest: frozen InterestCollected once released, live accrual
    while active), which the plan §4.4 rule makes authoritative. The
    client-side accrual is only a fallback for entries that lack it
    (mock/demo data) — recomputing it here is how a ₹713 vs ₹717
    day-boundary drift once appeared between table and tile. */
export function interestFor(entry: Entry): number {
  return entry.interest ?? accruedInterest(entry);
}