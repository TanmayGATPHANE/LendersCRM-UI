import { useEffect, useState } from "react";
import {
  fetchReportCustomers, fetchReportReleases, fetchReportSummary,
} from "../api/client.ts";
import type { CustomerReportRow, ReleaseReportRow, SummaryRow } from "../api/types.ts";
import { money, shortDate } from "../utils/format.ts";
import { selectCls } from "../components/ui.ts";
import { Field } from "../components/Field.tsx";
import { toast } from "../components/Toast.tsx";

/**
 * Reports (plan §3.6) — the books seen as whole-section tables, one tab
 * per report. Read-only: every row comes back computed from the API
 * (GET /api/reports/*) — nothing is calculated here and nothing is saved.
 *
 *   Summary   — one money row per month of the cash ledger: what went
 *               out on lends, what came back (partials + release legs),
 *               manual ±, and the month's net.
 *   Customers — per-customer lifetime track record: lends, money lent,
 *               returned, interest collected, still outstanding/accruing.
 *   Released  — per-released-collateral outcome: days held, principal
 *               recovered, interest frozen, the counter's actual cash.
 */

/** The Summary tab first — the year filter sits beside it. */
const TABS = ["Summary", "Customers", "Released"] as const;
type ReportTab = (typeof TABS)[number];

/** "2026-10" → "Oct 2026". */
function monthLabel(m: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, mm] = m.split("-");
  return `${MONTHS[Number(mm) - 1]} ${y}`;
}

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>("Summary");

  // Each tab fetches lazily and keeps its rows; the year slice re-runs
  // only the Summary fetch.
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [customers, setCustomers] = useState<CustomerReportRow[]>([]);
  const [releases, setReleases] = useState<ReleaseReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("all");
  const yearNum = year === "all" ? null : Number(year);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const p =
      tab === "Summary"
        ? fetchReportSummary(yearNum ?? undefined).then(setSummary)
        : tab === "Customers"
          ? fetchReportCustomers().then(setCustomers)
          : fetchReportReleases().then(setReleases);
    p.catch((e: unknown) => toast((e as Error).message))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tab, yearNum]);

  // The Summary year filter's options — the years the ledger has rows in.
  const years = [...new Set(summary.map((r) => r.month.slice(0, 4)))].sort().reverse();

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";
  const thR = `${th} text-right`;
  const td = "px-3 py-2";
  const tdR = `${td} text-right`;

  const tabHint: Record<ReportTab, string> = {
    Summary: "Money in and out, month by month — straight from the cash ledger.",
    Customers: "Every customer's track record across all their collaterals.",
    Released: "What each released collateral brought back, and how long the money was out.",
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Toolbar: report tabs on the left, year filter beside the Summary */}
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
        {tab === "Summary" && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            title="Filter by year"
            className={selectCls}
          >
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {/* The report — scrollable like every other table */}
      <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Loading…
          </div>
        ) : tab === "Summary" ? (
          <SummaryTable rows={summary} th={th} thR={thR} td={td} tdR={tdR} />
        ) : tab === "Customers" ? (
          <CustomersTable rows={customers} th={th} thR={thR} td={td} tdR={tdR} />
        ) : (
          <ReleasedTable rows={releases} th={th} thR={thR} td={td} tdR={tdR} />
        )}
      </div>
    </main>
  );
}

/** Summary — one row per month; the year dropdown is the page's only filter. */
function SummaryTable({ rows, th, thR, td, tdR }: {
  rows: SummaryRow[]; th: string; thR: string; td: string; tdR: string;
}) {
  if (rows.length === 0) return <Empty text="No cash movement recorded yet." />;
  const t = (k: keyof SummaryRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  return (
    <>
      {/* Mobile: one card per month */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {rows.map((r) => (
          <div key={r.month} className="rounded-xl border border-line p-3 shadow-sm">
            <p className="text-sm font-semibold text-ink">{monthLabel(r.month)}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="Lend out">{money(r.lentOut)}</Field>
              <Field label="Principal in">{money(r.principalIn)}</Field>
              <Field label="Interest in">{money(r.interestIn)}</Field>
              <Field label="Manual in" tone="in">{r.manualIn ? `+${money(r.manualIn)}` : "—"}</Field>
              <Field label="Manual out" tone="out">{r.manualOut ? `−${money(r.manualOut)}` : "—"}</Field>
              <Field label="Net" tone={r.net < 0 ? "out" : "in"}>{money(r.net)}</Field>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-tint p-3 text-sm">
          <span className="font-medium uppercase tracking-wider text-muted">Total</span>
          <span className="tabular-nums font-medium text-ink">
            Lend {money(t("lentOut"))} · In {money(t("principalIn") + t("interestIn") + t("manualIn"))} · Net{" "}
            <span className={t("net") < 0 ? "text-red-600" : "text-green-700"}>{money(t("net"))}</span>
          </span>
        </div>
      </div>

      <table className="hidden w-full table-fixed min-w-[760px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[14%]`}>Month</th>
          <th className={`${thR} w-[15%]`}>Lend Out</th>
          <th className={`${thR} w-[15%]`}>Principal In</th>
          <th className={`${thR} w-[14%]`}>Interest In</th>
          <th className={`${thR} w-[14%]`}>Manual In</th>
          <th className={`${thR} w-[14%]`}>Manual Out</th>
          <th className={`${thR} w-[14%]`}>Net</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.month} className="hover:bg-tint even:bg-tint/40">
            <td className={`${td} whitespace-nowrap text-xs text-slate`}>{monthLabel(r.month)}</td>
            <td className={`${tdR} text-ink`}>{money(r.lentOut)}</td>
            <td className={`${tdR} text-ink`}>{money(r.principalIn)}</td>
            <td className={`${tdR} text-ink`}>{money(r.interestIn)}</td>
            <td className={`${tdR} text-green-700`}>{r.manualIn ? `+${money(r.manualIn)}` : "—"}</td>
            <td className={`${tdR} text-red-600`}>{r.manualOut ? `−${money(r.manualOut)}` : "—"}</td>
            <td className={`${tdR} font-medium ${r.net < 0 ? "text-red-600" : "text-green-700"}`}>
              {money(r.net)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <tr className="text-xs">
          <td className={`${td} font-medium uppercase tracking-wider text-muted`}>Total</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("lentOut"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("principalIn"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("interestIn"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-green-700`}>{money(t("manualIn"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-red-600`}>{money(t("manualOut"))}</td>
          <td className={`${tdR} py-1.5 font-medium ${t("net") < 0 ? "text-red-600" : "text-green-700"}`}>
            {money(t("net"))}
          </td>
        </tr>
      </tfoot>
    </table>
    </>
  );
}

/** Customers — the lifetime track record per customer. */
function CustomersTable({ rows, th, thR, td, tdR }: {
  rows: CustomerReportRow[]; th: string; thR: string; td: string; tdR: string;
}) {
  if (rows.length === 0) return <Empty text="No customers yet." />;
  const t = (k: "totalLent" | "returnedPrincipal" | "interestCollected" | "activeOutstanding" | "interestAccruing") =>
    rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      {/* Mobile: one card per customer */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {rows.map((r) => (
          <div key={r.customerId} className="rounded-xl border border-line p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                {r.name}
                {r.address && (
                  <span className="ml-1.5 text-xs font-normal text-muted">· {r.address}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {r.lends} lends ({r.activeLends} active)
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Total lent">{money(r.totalLent)}</Field>
              <Field label="Returned">{money(r.returnedPrincipal)}</Field>
              <Field label="Interest collected" tone="in">{money(r.interestCollected)}</Field>
              <Field label="Outstanding" tone={r.activeOutstanding > 0 ? "ink" : "muted"}>
                {money(r.activeOutstanding)}
              </Field>
              <Field label="Accruing today" tone="muted">
                {r.interestAccruing ? money(r.interestAccruing) : "—"}
              </Field>
            </div>
          </div>
        ))}
        <div className="rounded-xl bg-tint p-3 text-sm">
          <span className="font-medium uppercase tracking-wider text-muted">Total</span>{" "}
          <span className="tabular-nums text-ink">
            Lent {money(t("totalLent"))} · Returned {money(t("returnedPrincipal"))} · Interest{" "}
            {money(t("interestCollected"))} · Outstanding {money(t("activeOutstanding"))}
          </span>
        </div>
      </div>

      <table className="hidden w-full table-fixed min-w-[860px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[18%]`}>Customer</th>
          <th className={`${th} w-[12%]`}>Lends</th>
          <th className={`${thR} w-[14%]`}>Total Lent</th>
          <th className={`${thR} w-[14%]`}>Returned</th>
          <th className={`${thR} w-[14%]`}>Interest Collected</th>
          <th className={`${thR} w-[14%]`}>Outstanding</th>
          <th className={`${thR} w-[14%]`}>Accruing Today</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.customerId} className="hover:bg-tint even:bg-tint/40">
            <td className={td}>
              {r.name}
              {r.address && (
                <span className="ml-1.5 whitespace-nowrap text-xs text-muted">
                  · {r.address}
                </span>
              )}
            </td>
            <td className={`${td} text-slate`}>
              {r.lends}
              <span className="text-xs text-muted"> ({r.activeLends} active)</span>
            </td>
            <td className={`${tdR} text-ink`}>{money(r.totalLent)}</td>
            <td className={`${tdR} text-ink`}>{money(r.returnedPrincipal)}</td>
            <td className={`${tdR} text-green-700`}>{money(r.interestCollected)}</td>
            <td className={`${tdR} font-medium ${r.activeOutstanding > 0 ? "text-ink" : "text-muted"}`}>
              {money(r.activeOutstanding)}
            </td>
            <td className={`${tdR} text-slate`}>{r.interestAccruing ? money(r.interestAccruing) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <tr className="text-xs">
          <td className={`${td} py-1.5 font-medium uppercase tracking-wider text-muted`}>Total</td>
          <td className={td}></td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("totalLent"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("returnedPrincipal"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-green-700`}>{money(t("interestCollected"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("activeOutstanding"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-slate`}>{money(t("interestAccruing"))}</td>
        </tr>
      </tfoot>
    </table>
    </>
  );
}

/** Released — the closed collaterals' outcome, newest release first. */
function ReleasedTable({ rows, th, thR, td, tdR }: {
  rows: ReleaseReportRow[]; th: string; thR: string; td: string; tdR: string;
}) {
  if (rows.length === 0) return <Empty text="Nothing released yet." />;
  const t = (k: "lent" | "recoveredPrincipal" | "interestCollected") =>
    rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      {/* Mobile: one card per released collateral */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {rows.map((r) => (
          <div key={r.groupId} className="rounded-xl border border-line p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                {r.item}
                <span className="ml-1.5 text-xs font-normal text-muted">· {r.customer}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {r.daysHeld} days held
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Field label="Lent">{money(r.lent)}</Field>
              <Field label="Recovered">{money(r.recoveredPrincipal)}</Field>
              <Field label="Interest" tone="in">{money(r.interestCollected)}</Field>
            </div>
            <p className="mt-2 text-xs text-muted">
              Released {r.releasedDate ? shortDate(r.releasedDate) : "—"}
              {r.totalCollected != null ? ` · collected ${money(r.totalCollected)}` : ""}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-tint p-3 text-sm">
          <span className="font-medium uppercase tracking-wider text-muted">Total</span>{" "}
          <span className="tabular-nums text-ink">
            Lent {money(t("lent"))} · Recovered {money(t("recoveredPrincipal"))} · Interest{" "}
            {money(t("interestCollected"))}
          </span>
        </div>
      </div>

      <table className="hidden w-full table-fixed min-w-[860px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[22%]`}>Collateral</th>
          <th className={`${thR} w-[13%]`}>Lent</th>
          <th className={`${th} w-[12%]`}>Released</th>
          <th className={`${thR} w-[9%]`}>Days Held</th>
          <th className={`${thR} w-[15%]`}>Recovered</th>
          <th className={`${thR} w-[14%]`}>Interest</th>
          <th className={`${thR} w-[15%]`}>Collected (cash)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.groupId} className="hover:bg-tint even:bg-tint/40">
            <td className={td}>
              {r.item}
              <span className="ml-1.5 whitespace-nowrap text-xs text-muted">
                · {r.customer}
              </span>
            </td>
            <td className={`${tdR} text-ink`}>{money(r.lent)}</td>
            <td className={`${td} whitespace-nowrap text-xs text-slate`}>
              {r.releasedDate ? shortDate(r.releasedDate) : "—"}
            </td>
            <td className={`${tdR} text-slate`}>{r.daysHeld}</td>
            <td className={`${tdR} text-ink`}>{money(r.recoveredPrincipal)}</td>
            <td className={`${tdR} text-green-700`}>{money(r.interestCollected)}</td>
            <td className={`${tdR} text-slate`}>
              {r.totalCollected != null ? money(r.totalCollected) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <tr className="text-xs">
          <td className={`${td} py-1.5 font-medium uppercase tracking-wider text-muted`}>Total</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("lent"))}</td>
          <td className={td}></td>
          <td className={tdR}></td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("recoveredPrincipal"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-green-700`}>{money(t("interestCollected"))}</td>
          <td className={tdR}></td>
        </tr>
      </tfoot>
    </table>
    </>
  );
}

/** The empty-report state (same shape as the other pages'). */
function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-12 text-center">
      <i className="ph ph-chart-bar text-2xl text-dim" aria-hidden="true" />
      <span className="text-sm text-slate">{text}</span>
    </div>
  );
}