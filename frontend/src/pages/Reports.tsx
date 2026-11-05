import { useEffect, useState } from "react";
import {
  fetchReportCustomers, fetchReportReleases, fetchReportSummary,
} from "../api/client.ts";
import type { CustomerReportRow, ReleaseReportRow, SummaryRow } from "../api/types.ts";
import { money } from "../utils/format.ts";
import { toast } from "../components/Toast.tsx";
import DateRangePicker, { fmtISO } from "../components/DateRangePicker.tsx";
import useDateRange from "../utils/useDateRange.ts";
import NetLine from "../components/viz/NetLine.tsx";
import RankedBars from "../components/viz/RankedBars.tsx";
import TrendColumns from "../components/viz/TrendColumns.tsx";
import { ChartCard, Legend } from "../components/viz/VizShared.tsx";
import { VIZ } from "../components/viz/viz.ts";
import { monthLabel, monthTick } from "../components/reports/shared.tsx";
import SummaryTable from "../components/reports/SummaryTable.tsx";
import CustomersTable from "../components/reports/CustomersTable.tsx";
import ReleasedTable from "../components/reports/ReleasedTable.tsx";

/**
 * Reports (plan §3.6) — the books seen as whole-section tables, one tab
 * per report. Read-only: every row comes back computed from the API
 * (GET /api/reports/*) — nothing is calculated here and nothing is saved.
 *
 *   Summary   — one money row per month of the cash ledger (see
 *               components/reports/SummaryTable.tsx).
 *   Customers — per-customer lifetime track record (CustomersTable.tsx).
 *   Released  — per-released-collateral outcome (ReleasedTable.tsx).
 *
 * This page owns only: the tab switcher, the global date-range picker
 * (calendar button + popover) that scopes every tab, the fetches, and the
 * small chart shims that
 * reshape the same rows the tables show. The three tables live in
 * components/reports/ — one file each.
 *
 * The range opens on THIS MONTH so a year-sized book never
 * loads itself on entry (the sidebar's All time widens it). Charts collapse
 * to
 * their headers by default so the data table is the first thing you
 * reach; every chart's numbers are also in the table right below it —
 * the tooltip enhances, it never gates. The Released tab has no chart —
 * its table alone carries the lent/recovered facts.
 */

/** The Summary tab first — the range picker sits beside it. */
const TABS = ["Summary", "Customers", "Released"] as const;
type ReportTab = (typeof TABS)[number];

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>("Summary");

  // Each tab fetches lazily and keeps its rows; the global date-range
  // picker re-runs the active tab's fetch. All time = the whole book.
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [customers, setCustomers] = useState<CustomerReportRow[]>([]);
  const [releases, setReleases] = useState<ReleaseReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  // One shared open/closed state for every chart card on the page —
  // expanding one expands all of them (Summary's two charts move
  // together), collapsing one collapses all. Starts collapsed, like the
  // cards' own default.
  const [chartsOpen, setChartsOpen] = useState(false);
  // The range opens on This month (the page's default); the picker's
  // state contract (selection + confirmed window) is persisted per page.
  const { selected, range, applyCustom } =
    useDateRange("ams-reports-range", "This month");

  useEffect(() => {
    let live = true;
    setLoading(true);
    // The picker gives full-day bounds — DATE data wants local ISO days,
    // exactly what the backend's from/to (inclusive) slice.
    const from = fmtISO(range.start), to = fmtISO(range.end);
    const p =
      tab === "Summary"
        ? fetchReportSummary(from, to).then(setSummary)
        : tab === "Customers"
          ? fetchReportCustomers(from, to).then(setCustomers)
          : fetchReportReleases(from, to).then(setReleases);
    p.catch((e: unknown) => toast((e as Error).message))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tab, range]);

  // Chart derivations — the same rows the tables get below, reshaped for
  // each picture. The filter above scopes both, so chart and table
  // always agree on which slice of the books they show.
  const trend = summary.map((r, i) => ({
    label: monthLabel(r.month),
    tick: monthTick(r.month, i > 0 ? summary[i - 1].month : null),
    lentOut: r.lentOut,
    moneyIn: r.principalIn + r.interestIn + r.manualIn,
    net: r.net,
  }));
  const netTrend = summary.map((r, i) => ({
    label: monthLabel(r.month),
    tick: monthTick(r.month, i > 0 ? summary[i - 1].month : null),
    net: r.net,
  }));
  const outstandingRows = [...customers]
    .filter((c) => c.activeOutstanding > 0)
    .sort((a, b) => b.activeOutstanding - a.activeOutstanding)
    .slice(0, 8)
    .map((c) => ({
      name: c.name,
      value: c.activeOutstanding,
      detail: `${c.lends} lends (${c.activeLends} active) · lent ${money(c.totalLent)}`,
    }));
  // The dumbbell chart was removed from the Released tab — the Released
  // table below carries the same facts (lent, recovered, interest, days
  // held) as plain rows.

  const tabHint: Record<ReportTab, string> = {
    Summary: "Money in and out, month by month — straight from the cash ledger.",
    Customers: "Every customer's track record across all their collaterals.",
    Released: "What each released collateral brought back, and how long the money was out.",
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Toolbar: report tabs on the left; the date-range picker (presets
          + custom window) on the right scopes every tab — charts and
          tables, one window on the books. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-300 ease-brand
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                tab === t ? "bg-primary text-on-primary" : "text-slate hover:bg-tint-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">{tabHint[tab]}</span>
        <div className="flex-1" />
        <DateRangePicker selected={selected} range={range} onApply={applyCustom} />
      </div>

      {/* Charts + the report — one scroll column; the filter above scopes
          both, the charts collapse to their headers by default so the data
          is the first thing on the page, and the report box keeps its own
          (sticky-headered) scroll under a cap so long books never push. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">
        {!loading && tab === "Summary" && trend.length > 0 && (
          <div className="grid shrink-0 gap-3 lg:grid-cols-2">
            <ChartCard
              defaultCollapsed
              open={chartsOpen}
              onToggle={setChartsOpen}
              title="Money in vs out"
              subtitle="Lend out against everything collected, month by month (₹)"
              legend={
                <Legend
                  items={[
                    { kind: "bar", color: VIZ.series2, label: "Lent out" },
                    { kind: "bar", color: VIZ.series1, label: "Money in" },
                  ]}
                />
              }
            >
              <TrendColumns data={trend} />
            </ChartCard>
            <ChartCard defaultCollapsed open={chartsOpen} onToggle={setChartsOpen} title="Net cash by month" subtitle="What the month's movement left in hand (₹)">
              <NetLine data={netTrend} />
            </ChartCard>
          </div>
        )}
        {!loading && tab === "Customers" && outstandingRows.length > 0 && (
          <ChartCard
            className="shrink-0"
            defaultCollapsed
            open={chartsOpen}
            onToggle={setChartsOpen}
            title="Outstanding by customer"
            subtitle="Money still out on active collaterals, largest first (₹)"
          >
            <RankedBars rows={outstandingRows} />
          </ChartCard>
        )}

        {loading ? (
          <div className="flex min-h-40 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-sm text-muted shadow-sm">
            Loading…
          </div>
        ) : tab === "Summary" ? (
          <div className="max-h-[60vh] shrink-0 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
            <SummaryTable rows={summary} />
          </div>
        ) : tab === "Customers" ? (
          <div className="max-h-[60vh] shrink-0 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
            <CustomersTable rows={customers} />
          </div>
        ) : (
          <div className="max-h-[60vh] shrink-0 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
            <ReleasedTable rows={releases} />
          </div>
        )}
      </div>
    </main>
  );
}