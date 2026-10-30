import type { Insights } from "../api/types.ts";
import { money } from "../utils/format.ts";

/**
 * InsightsBar — the three headline numbers on top of the Dashboard.
 * Labels and values follow the selected tab:
 *   All      → the backend's global totals (Total Amanat / Interest FY /
 *              Total Cash Available).
 *   Active   → what the working set looks like: money still out, interest
 *              accrued so far, partials received against active
 *              collaterals.
 *   Released → what closed collaterals brought home: principal recovered,
 *              interest collected, cash at the counter from releases.
 * Values come from fetchInsights() on All and from tabInsights()
 * (backend formulas mirrored) on the other tabs, refreshed with every
 * change to the books.
 */
interface Props {
  insights: Insights;
  tab?: string;
}

export default function InsightsBar({ insights, tab = "All" }: Props) {
  // [label, value, hover-hint] per tile, keyed by the tab they belong to.
  const tiles: Record<"All" | "Active" | "Released", [string, number, string][]> = {
    All: [
      [
        "Total Amanat",
        insights.totalAmanat,
        "Money currently lent out on active collaterals",
      ],
      [
        "Interest Earned (FY)",
        insights.interestEarned,
        "Interest collected from releases this financial year (Apr–Mar)",
      ],
      [
        "Total Cash Available",
        insights.cashAvailable,
        "Partial returns received + everything handed over at releases",
      ],
    ],
    Active: [
      [
        "Total Amanat",
        insights.totalAmanat,
        "Money still in customers' hands on the active collaterals shown",
      ],
      [
        "Interest Outstanding",
        insights.interestEarned,
        "Accrued live on the active lends so far — freezes when they release",
      ],
      [
        "Received (Active)",
        insights.cashAvailable,
        "Partial returns received against the still-active collaterals",
      ],
    ],
    Released: [
      [
        "Recovered",
        insights.totalAmanat,
        "Principal that came back across the released collaterals",
      ],
      [
        "Interest Collected",
        insights.interestEarned,
        "Interest frozen on the released collaterals",
      ],
      [
        "Cash from Releases",
        insights.cashAvailable,
        "Principal + interest collected on release days (Cash page rows)",
      ],
    ],
  };
  const items = tiles[tab as "All" | "Active" | "Released"]; // tabs are only ever these three

  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 pb-3 sm:grid-cols-3">
      {items.map(([label, value, hint]) => (
        <div
          key={label}
          title={hint}
          className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm"
        >
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
            {label}
          </div>
          <div className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
            {money(value)}
          </div>
        </div>
      ))}
    </div>
  );
}