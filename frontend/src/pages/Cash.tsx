import { useEffect, useMemo, useState } from "react";
import {
  addManualCash, canEdit, deleteCashEntry, fetchCashLedger, fetchEntries,
} from "../api/client.ts";
import type { CashLedgerItem, Entry } from "../api/types.ts";
import CashEntryDialog from "../components/dialogs/CashEntryDialog.tsx";
import { inputCls, primaryBtnCls } from "../components/ui.ts";
import { money, shortDate } from "../utils/format.ts";
import { toast } from "../components/Toast.tsx";

/**
 * Cash — the Total Cash Available ledger as its own page, read straight
 * from the SQL CashLedger table (§3.5): every rupee moving over the
 * counter is a stored row. A LEND posts one negative row the day the
 * money goes out; a release posts TWO rows on release day — principal
 * received and interest collected; a partial return posts one; a manual
 * +/− movement outside the business posts one signed row. SUM(amount) is
 * the total, which always ties to the dashboard tile and the database.
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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  async function refresh() {
    const [rows, es] = await Promise.all([fetchCashLedger(), fetchEntries()]);
    setLedger(rows);
    setEntries(es);
  }

  useEffect(() => {
    refresh();
  }, []);

  /** Delete one manual movement (a corrected mistake). */
  async function removeEntry(id: number, notes: string) {
    if (!window.confirm(`Delete this cash entry${notes ? ` (${notes})` : ""}?`)) return;
    try {
      await deleteCashEntry(id);
      toast("Cash entry removed", "ok");
      await refresh();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  // Join each lending row with its collateral (customer · item) for the
  // Source column; manual rows stand alone — they are outside the business.
  const rows = useMemo(() => {
    const byGroup = new Map<number, Entry>();
    for (const e of entries) {
      const existing = byGroup.get(e.groupId);
      if (!existing || e.date < existing.date) byGroup.set(e.groupId, e);
    } // keep the earliest lend — the group's headline

    return ledger
      .map<CashRow>((l) => {
        const g = l.groupId ? byGroup.get(l.groupId) : undefined;
        const label = SOURCE_LABEL[l.source];
        return {
          date: l.date,
          amount: l.amount,
          label,
          who: g ? `${g.customerName} · ${g.item}` : "Outside the business",
          notes: l.notes || "",
          row: l,
        };
      })
      .sort((a, b) =>
        b.date.localeCompare(a.date) || a.row.id - b.row.id
      ); // newest day first; within one day the id keeps book order
  }, [ledger, entries]);

  // Search over the source text, who paid and the notes.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => !q || `${r.label} ${r.who} ${r.notes}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // The filter applies to the view only — the real Total Cash Available
  // is SUM(Amount) over the whole table (the backend's insights tile).
  const total = shown.reduce((s, r) => s + r.amount, 0);

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";
  const thR = `${th} text-right`;

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-6 py-4">
      {/* Toolbar: search on the left, running total on the right */}
      <div className="flex shrink-0 items-center gap-3 pb-3">
        <div className="max-w-xs flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source, customer or notes…"
            className={inputCls}
          />
        </div>
        <div className="flex-1" />
        <span className="text-sm text-muted">
          {shown.length} {shown.length === 1 ? "entry" : "entries"} ·{" "}
          <b className="text-ink">{money(total)}</b> in hand
        </span>
        {canEdit() && (
          <button onClick={() => setAddOpen(true)} className={primaryBtnCls}>
            + / − Cash Entry
          </button>
        )}
      </div>

      {/* The ledger — scrollable like the other tables */}
      <div className="table-scroll flex-1 overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        <table className="w-full table-fixed min-w-[640px] text-sm">
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
            {shown.map((r) => {
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
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
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
                          onClick={() => removeEntry(r.row.id, r.notes)}
                          title="Delete this cash entry"
                          className="material-symbols-outlined cursor-pointer text-[18px] text-dim hover:text-red-600"
                        >
                          delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={canEdit() ? 5 : 4} className="px-3 py-12">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="material-symbols-outlined text-[28px] text-dim">payments</span>
                    <span className="text-sm text-slate">No cash entries</span>
                    <span className="text-xs text-muted">
                      Rows appear as money moves over the counter — lends go out, returns come in.
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CashEntryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />
    </main>
  );
}