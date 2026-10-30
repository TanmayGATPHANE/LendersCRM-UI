// Partial-return rules from notes/requirements-plan.md §4.6.
//
// A partial return is money the customer hands back before the final
// release. It is recorded against the whole collateral group and cuts the
// outstanding principal oldest-lend-first (FIFO): the earliest active lend
// is reduced to nothing before the next one is touched.

import type { Entry } from "../api/types.ts";

/**
 * Spread a group's total partial returns across its lends, oldest first.
 * Returns a Map of entryId -> amount covered. Released lends and nothing
 * beyond the group's active principal stay out of the allocation.
 *
 * The Dashboard attaches these values to each lend as `paid`, which is
 * how accruedInterest() knows to run on the reduced principal.
 */
export function allocatePaid(subs: Entry[], partialTotal: number): Map<number, number> {
  const paid = new Map<number, number>();
  let remaining = Math.max(0, partialTotal);
  const active = [...subs]
    .filter((s) => s.status === "Active")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  for (const s of active) {
    const cover = Math.min(remaining, s.amount);
    paid.set(s.id, cover);
    remaining -= cover;
  }
  return paid;
}