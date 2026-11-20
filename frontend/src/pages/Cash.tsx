import { useEffect, useMemo, useState } from "react";
import {
  addManualCash, canEdit, deleteCashEntry, fetchCashLedger, fetchCashTotal,
} from "../api/client.ts";
import type { CashLedgerItem } from "../api/types.ts";
import CashEntryDialog from "../components/dialogs/CashEntryDialog.tsx";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { SkeletonCards, SkeletonRows } from "../components/Skeleton.tsx";
import { LoadMore, useChunkedRows } from "../components/LoadMore.tsx";
import { inputCls, primaryBtnCls } from "../components/ui.ts";
import MonthYearFilter from "../components/MonthYearFilter.tsx";
import { fmtISO, money, shortDate, windowFrom } from "../utils/format.ts";
import { toast } from "../components/Toast.tsx";

/**
 * Cash — the Total Cash Available ledger as its own page, read straight
 * from the SQL CashLedger table (§3.5): every rupee moving over the
 * counter is a stored row. A LEND posts one negative row the day the
 * money goes out; a release posts TWO rows on release day — principal
 * received and interest collected; a partial return posts one; a manual
 * +/− movement outside the business posts one signed row.
 *
 * The date-range picker opens on THIS MONTH (the picker's presets and
 * popover widen it). The list itself is paged — rows load 50 at a time
 * so a year of counter activity never lays itself all out at once; the
 * window sum, and "in hand" (SUM over the whole table, from its own
 * endpoint), are always whole-window figures, not the displayed page's.
 */

/** What the Source column says for each stored row kind. */
const SOURCE_LABEL: Record<CashLedgerItem["source"], string> = {
  Lend: "Lend",
  PartialReturn: "Partial return",
  ReleasePrincipal: "Release · principal",
  ReleaseInterest: "Release · interest",
  Manual: "Manual cash (±)",
};

/** One display row — a stored ledger row joined with its collateral. */
interface CashRow {
  date: string;
  amount: number;
  label: string;
  who: string;
  notes: string;
  row: CashLedgerItem;
}

export default function Cash() {
  const [ledger, setLedger] = useState<CashLedgerItem[]>([]);
  const [search, setSearch] = useState("");
  // Month/year like the Dashboard's — defaults current year, all months,
  // never persisted; both "all" opens the whole book.
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  // SUM(Amount) over the whole CashLedger table — the dashboard's number,
  // from its own endpoint so the window above never fakes it smaller.
  const [inHand, setInHand] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // First-load skeleton: grey rows until the ledger slice arrives; range
  // changes after that keep the previous rows on screen (no flicker).
  const [loading, setLoading] = useState(true);
  // The delete confirmation (in-app, not window.confirm) + its target.
  const [deleting, setDeleting] = useState<CashLedgerItem | null>(null);

  async function refresh() {
    // Only the window's slice comes over the wire; "in hand" is the
    // whole-book SUM from its own endpoint.
    const { from, to } = windowFrom(month, year);
    const [rows, cashInHand] = await Promise.all([
      fetchCashLedger(from, to), fetchCashTotal(),
    ]);
    setLedger(rows);
    setInHand(cashInHand);
    setLoading(false);
  }

  // The window refetches its slice from the server; the search box
  // stays client-side over what is already loaded.
  useEffect(() => {
    refresh();
  }, [month, year]);

  /** Delete one manual movement (a corrected mistake) — confirmed in the
      app's own dialog, never the browser's raw popup. */
  async function removeEntry(id: number, notes: string) {
    try {
      await deleteCashEntry(id);
      toast("Cash entry removed", "ok");
      await refresh();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  // The customer · item label is joined SERVER-SIDE (the cash page never
  // loads the entries table); manual rows stand alone — they are outside
  // the business.
  const rows = useMemo(() =>
    ledger
      .map<CashRow>((l) => ({
        date: l.date,
        amount: l.amount,
        label: SOURCE_LABEL[l.source],
        who: l.customer ? `${l.customer} · ${l.item ?? ""}`.replace(/ · $/, "") : "Outside the business",
        notes: l.notes || "",
        row: l,
      }))
      .sort((a, b) =>
        b.date.localeCompare(a.date) || a.row.id - b.row.id
      ), // newest day first; within one day the id keeps book order
    [ledger]);

  // Search over the source text, who paid and the notes; the month/year
  // window scopes the view (the API already returned just that slice —
  // the client-side bounds simply keep the search honest after saves).
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = windowFrom(month, year);
    return rows.filter(
      (r) =>
        (!q || `${r.label} ${r.who} ${r.notes}`.toLowerCase().includes(q)) &&
        (!from || r.date >= from) && (!to || r.date <= to)
    );
  }, [rows, search, month, year]);

  // The filters apply to the view only — the real Total Cash Available
  // is SUM(Amount) over the whole table (the backend's insights tile),
  // shown as "in hand"; the filtered sum is labelled per-window.
  const total = shown.reduce((s, r) => s + r.amount, 0);
  const grandTotal = inHand ?? 0;
  const windowed = !(month === "all" && year === "all");
  // Years the month filter's dropdown offers: the ledger + the current year.
  const years = useMemo(() => {
    const ys = new Set<string>([String(new Date().getFullYear())]);
    for (const r of rows) if (r.date) ys.add(r.date.slice(0, 4));
    return [...ys].sort().reverse();
  }, [rows]);

  // Paged rendering: 50 rows, growing by chunks (scroll or button),
  // so 2,000 ledger rows never render at once.
  const [visible, moreRows] = useChunkedRows(shown.length);
  const visibleRows = shown.slice(0, visible);

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";
  const thR = `${th} text-right`;

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Toolbar: search + month/year filters on the left, running total on the right */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <div className="min-w-44 max-w-xs flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source, customer or notes…"
            className={inputCls}
          />
        </div>
        <MonthYearFilter month={month} year={year} years={years} onMonth={setMonth} onYear={setYear} />
        <div className="flex-1" />
        <span className="text-sm text-muted">
          {shown.length} {shown.length === 1 ? "entry" : "entries"} ·{" "}
          <b className="text-ink">{money(total)}</b>
          {windowed ? " in window" : ""} · {money(grandTotal)} in hand
        </span>
        {canEdit() && (
          <button onClick={() => setAddOpen(true)} className={primaryBtnCls}>
            + / − Cash Entry
          </button>
        )}
      </div>

      {/* The ledger — scrollable like the other tables */}
      <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        {/* Mobile: one card per money movement */}
        <div className="stagger space-y-2 p-3 md:hidden">
          {loading ? <SkeletonCards count={5} /> : (
          <>
          {visibleRows.map((r) => {
            const manual = r.row.source === "Manual";
            const signed = manual || r.row.source === "Lend";
            return (
              <div key={r.row.id} className="rounded-xl border border-line p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.row.source === "ReleaseInterest" ? "bg-tint text-primary" : "bg-tint text-slate"
                      }`}
                    >
                      {r.label}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{r.who}</span>
                    <span className="mt-0.5 block text-xs text-muted">{shortDate(r.date)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        signed ? (r.amount > 0 ? "text-green-700" : "text-red-600") : "text-ink"
                      }`}
                    >
                      {signed ? (r.amount > 0 ? "+" : "−") : ""}{money(Math.abs(r.amount))}
                    </span>
                    {manual && canEdit() && (
                      <button
                        onClick={() => setDeleting(r.row)}
                        title="Delete this cash entry"
                        className="cursor-pointer text-dim hover:text-red-600
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                                   transition-colors duration-300 ease-brand"
                      >
                        <i className="ph ph-trash text-lg" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {r.notes && <p className="mt-2 truncate text-xs text-slate">{r.notes}</p>}
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-12 text-center">
              <i className="ph ph-coins text-2xl text-dim" aria-hidden="true" />
              <span className="text-sm text-slate">No cash entries</span>
              <span className="text-xs text-muted">
                Rows appear as money moves over the counter — lends go out, returns come in.
              </span>
            </div>
          )}
          </>
          )}
        </div>

        <table className="hidden w-full table-fixed min-w-[640px] text-sm md:table">
          <thead className="sticky top-0 z-10 bg-card border-b border-line">
            <tr>
              <th className={`${th} w-[13%]`}>Date</th>
              <th className={th}>Source</th>
              <th className={`${thR} w-[13%]`}>Amount</th>
              <th className={`${th} w-[22%]`}>Notes</th>
              {canEdit() && <th className={`${thR} w-[8%]`}></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <SkeletonRows rows={8} cols={canEdit() ? 5 : 4} />
            ) : (
            <>
            {visibleRows.map((r) => {
              const manual = r.row.source === "Manual";
              // Money out (lends, manual −) always shows its sign in red;
              // manual + shows green. Lending rows are never green-signed.
              const signed = manual || r.row.source === "Lend";
              return (
                <tr key={r.row.id} className="hover:bg-tint even:bg-tint/40">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate">{shortDate(r.date)}</td>
                  <td className="px-3 py-2">
                    {/* Neutral chip for the row kind (like the role/status
                        badges) — red is reserved for the amount leaving. */}
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.row.source === "ReleaseInterest"
                          ? "bg-tint text-primary"
                          : "bg-tint text-slate"
                      }`}
                    >
                      {r.label}
                    </span>
                    <span className="text-slate"> — {r.who}</span>
                  </td>
                  {/* Money-out rows (lends, manual −) show their sign. */}
                  <td className={`px-3 py-2 text-right ${
                    signed
                      ? r.amount > 0 ? "text-green-700" : "text-red-600"
                      : "text-ink"
                  }`}>
                    {signed ? (r.amount > 0 ? "+" : "−") : ""}{money(Math.abs(r.amount))}
                  </td>
                  <td className="px-3 py-2 text-slate">{r.notes || "—"}</td>
                  {canEdit() && (
                    <td className="px-3 py-2 text-right">
                      {manual && (
                        <button
                          onClick={() => setDeleting(r.row)}
                          title="Delete this cash entry"
                          className="cursor-pointer text-dim hover:text-red-600
                                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                                     transition-colors duration-300 ease-brand"
                        >
                          <i className="ph ph-trash text-lg" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr className="hidden md:table-row">
                <td colSpan={canEdit() ? 5 : 4} className="px-3 py-12">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <i className="ph ph-coins text-2xl text-dim" aria-hidden="true" />
                    <span className="text-sm text-slate">No cash entries</span>
                    <span className="text-xs text-muted">
                      Rows appear as money moves over the counter — lends go out, returns come in.
                    </span>
                  </div>
                </td>
              </tr>
            )}
            </>
            )}
          </tbody>
        </table>

        {/* The paged footer — BELOW the table, so on desktop it sits at
            the end of the scrolled content (an auto-load observer above
            the rows would fire on mount and drain the whole page). */}
        <LoadMore visible={visible} total={shown.length} onMore={moreRows} />
      </div>

      <CashEntryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />

      {/* The delete confirmation — the app's own dialog, not the browser's */}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Cash Entry"
        message={
          deleting
            ? `Remove this ${deleting.amount < 0 ? "money out" : "money in"} row of ${money(deleting.amount)}${deleting.notes ? ` (${deleting.notes})` : ""}? Only manual movements can be removed — the books return to what they said before it was recorded.`
            : ""
        }
        confirmLabel="Delete Entry"
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? removeEntry(deleting.id, deleting.notes ?? "") : Promise.resolve())}
      />
    </main>
  );
}