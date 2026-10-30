// Search logic shared by the Dashboard (and any future views).

import type { CollateralGroup } from "../api/types.ts";
import { shortDate } from "./format.ts";

/**
 * matchesGroup — does a collateral group match the search box? Searches
 * EVERYTHING a global search should reach, on one flat haystack:
 *   - customer name, collateral item (headline + every individual lend)
 *   - dates in both shapes: ISO "2026-10-12" and shown "12 Oct 2026"
 *     (so "oct", "2026", "10-12" all hit; searching a date finds the
 *     group and every lend/partial on it)
 *   - amounts (headline total, outstanding, each lend, each payment)
 *   - notes on lends and partial returns
 * Multi-word queries are an ALL-of match: each word must hit somewhere,
 * so "tanmay oct" finds Tanmay's October lends.
 */
export function matchesGroup(group: CollateralGroup, raw: string | undefined | null): boolean {
  const words = (raw ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const g = group;
  const hay = [
    g.customerName,
    g.item,

    // Headline numbers, raw digits so "5000" matches ₹5,000.
    g.totalAmount,
    g.outstanding,

    // Every lend's own date / item / amount / notes / status.
    ...g.subs.flatMap((s) => [
      s.date, shortDate(s.date), s.item, s.amount, s.notes, s.status, s.rate,
    ] as const),

    // Every partial return's date / notes / amount.
    ...g.partials.flatMap((p) => [p.date, shortDate(p.date), p.notes, p.amount] as const),
  ]
    .filter((x) => x != null)
    .join(" ")
    .toLowerCase();

  return words.every((w) => hay.includes(w));
}