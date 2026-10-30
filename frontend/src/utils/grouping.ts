// Collateral-group building shared by the Dashboard and the customer
// History modal (notes/requirements-plan.md §4.3 and §4.6).

import type { CollateralGroup, Entry, Payment } from "../api/types.ts";
import { allocatePaid } from "./repayment.ts";
import { interestFor } from "./interest.ts";

/**
 * Collapse a flat entry list into collateral groups: one record per
 * groupId, carrying the group's totals and its individual lends (each
 * with `paid` attached — partial returns allocated oldest-first — so
 * interest.ts can accrue on the reduced principal).
 */
export function buildGroups(entries: Entry[], partials: Payment[] = []): CollateralGroup[] {
  const byGroup = new Map<number, Entry[]>();
  for (const e of entries) {
    if (!byGroup.has(e.groupId)) byGroup.set(e.groupId, []);
    byGroup.get(e.groupId)!.push(e);
  }
  return [...byGroup.values()].map((subs) => {
    const primary: Entry = subs.reduce((a, b) => (a.date <= b.date ? a : b)); // earliest lend
    const activeSubs: Entry[] = subs.filter((s) => s.status === "Active");

    // Partial returns for this group, split across active lends FIFO.
    const groupPartials = partials
      .filter((p) => p.groupId === primary.groupId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const totalPaid = groupPartials.reduce((s, p) => s + p.amount, 0);
    const paidMap = allocatePaid(subs, totalPaid);

    const activePrincipal = activeSubs.reduce((s, x) => s + x.amount, 0);
    return {
      groupId: primary.groupId,
      primary, // the entry whose fields this row displays / edits
      customerId: primary.customerId,
      customerName: primary.customerName,
      customerAddress: primary.customerAddress ?? "",
      item: primary.item,
      date: primary.date,
      subs: subs.map((s) => ({ ...s, paid: paidMap.get(s.id) ?? 0 })),
      partials: groupPartials,
      activeSubs,
      activePrincipal,
      totalPaid,
      outstanding: activePrincipal - totalPaid,
      totalAmount: subs.reduce((s, x) => s + x.amount, 0),
      status: activeSubs.length ? "Active" : "Released",
    } satisfies CollateralGroup;
  });
}

/**
 * Rate text for a group row: the shared rate, or "mixed" when sub-lends
 * were given different rates. "—" means interest-free.
 */
export function groupRateText(group: CollateralGroup): string {
  const rates = [...new Set(group.subs.map((s) => s.rate ?? null))];
  if (rates.length > 1) return "mixed";
  const r = rates[0];
  return r == null ? "—" : `${r}%/mo`;
}

/**
 * Total interest shown for a group: live accrual for active lends, frozen
 * values for released ones.
 */
export function groupInterest(group: CollateralGroup): number {
  return group.subs.reduce((s, x) => s + interestFor(x), 0);
}

/** Total interest a customer has actually paid (released groups only). */
export function interestCollected(groups: CollateralGroup[]): number {
  return groups
    .filter((g) => g.status === "Released")
    .reduce((s, g) => s + g.subs.reduce((t, x) => t + (x.interestCollected ?? 0), 0), 0);
}