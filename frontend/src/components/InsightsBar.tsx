import { useEffect, useRef, useState } from "react";
import type { Insights } from "../api/types.ts";
import { money } from "../utils/format.ts";
import { pulse } from "../utils/pulse.ts";

/** Counts a number up (or down) to its target over ~0.7s on the brand
    curve's cubic equivalent. Static under prefers-reduced-motion. */
function useCountUp(target: number, ms = 700): number {
  const [shown, setShown] = useState(target);
  const prev = useRef(0); // first paint counts up from 0
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3); // cubic ease-out, matches ease-brand's feel
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

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
        "Money in hand: what you lent out (−), partial returns, the two release legs and manual ± — straight from the cash table",
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
        "Cash Out (Active)",
        insights.cashAvailable,
        "Cash the drawer gave out on the active collaterals (lends − partials received) — every rupee of Total Amanat is cash not in hand",
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
    <div className="stagger grid shrink-0 grid-cols-1 gap-3 pb-3 sm:grid-cols-3">
      {items.map(([label, value, hint]) => (
        <Tile key={`${tab}-${label}`} label={label} value={value} hint={hint} tab={tab} />
      ))}
    </div>
  );
}

/** One headline-number tile: count-up value, hover lift, green pulse when
    the number it shows has just changed. Flashes are keyed per tab so
    switching tabs — a different triple of numbers — never blinks; only a
    save on the books does. */
function Tile({ label, value, hint, tab }: {
  label: string; value: number; hint: string; tab: string;
}) {
  const shown = useCountUp(value);
  const ref = useRef<HTMLDivElement | null>(null);
  const prev = useRef<{ tab: string; value: number } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { tab, value };
    if (before && before.tab === tab && before.value !== value) pulse(ref.current);
  }, [value, tab]);

  return (
    <div
      title={hint}
      ref={ref}
      className="cursor-default rounded-xl border border-line bg-card px-4 py-3 shadow-sm
                 transition duration-300 ease-brand hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-ink">
        {money(shown)}
      </div>
    </div>
  );
}