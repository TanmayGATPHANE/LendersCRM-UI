import { useEffect, useRef, useState } from "react";
import type { Insights } from "../api/types.ts";
import { money } from "../utils/format.ts";
import { pulse } from "../utils/pulse.ts";
import { Skeleton } from "./Skeleton.tsx";

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
 * Total Amanat is the sum of the tab's lend amounts (all / active /
 * released — no deductions); the interest tile follows the tab (FY
 * collected / accrued live / frozen); Total Cash Available is the SAME
 * figure on every tab — the cash table's own SUM, nothing else.
 * Values come from fetchInsights(), refreshed with every change.
 */
interface Props {
  insights: Insights;
  tab?: string;
  /** Nothing fetched yet → the three tiles stand as grey blocks. */
  loading?: boolean;
}

export default function InsightsBar({ insights, tab = "All", loading = false }: Props) {
  if (loading) {
    // First-fetch skeleton: same tile frames, grey blocks before the numbers.
    return (
      <div className="grid shrink-0 grid-cols-1 gap-3 pb-3 sm:grid-cols-3">
        {["Total Amanat", "Interest", "Total Cash Available"].map((t) => (
          <div key={t} className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">{t}</span>
            <Skeleton className="mt-2.5 h-7 w-28" />
          </div>
        ))}
      </div>
    );
  }
  return <InsightsTiles insights={insights} tab={tab} />;
}

function InsightsTiles({ insights, tab }: { insights: Insights; tab: string }) {
  // [label, value, hover-hint] per tile, keyed by the tab they belong to.
  // The Amanat label names its tab: the figures follow the tab's rows.
  const amanatLabel =
    tab === "Active" ? "Total Amanat (Active)"
    : tab === "Released" ? "Total Amanat (Released)"
    : "Total Amanat (Active + Released)";
  const amanatHint =
    tab === "Active" ? "Sum of the lend amounts on active collaterals"
    : tab === "Released" ? "Sum of the lend amounts on released collaterals"
    : "Sum of every lend's amount on the books";
  const interestTile: [string, string] =
    tab === "Active" ? ["Interest Outstanding", "Accrued live on the active lends so far — freezes when they release"]
    : tab === "Released" ? ["Interest Collected", "Interest frozen on the released collaterals"]
    : ["Interest Earned + Outstanding", "Interest collected across every release, plus the accrued interest still to come with future releases"];
  const items: [string, number, string][] = [
    [amanatLabel, insights.totalAmanat, amanatHint],
    [interestTile[0], insights.interestEarned, interestTile[1]],
    [
      "Total Cash Available",
      insights.cashAvailable,
      "SUM over the WHOLE cash table — lends (−), partial returns, the two release legs and manual ±. Unaffected by the tab, search or month/year filters",
    ],
  ];

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