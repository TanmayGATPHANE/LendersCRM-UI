import { useEffect, useMemo, useState } from "react";
import { fetchEntries, fetchPartials } from "../api/client.ts";
import type { Entry, Payment } from "../api/types.ts";
import { inputCls } from "../components/ui.ts";
import { money, shortDate } from "../utils/format.ts";

/**
 * Cash — the Total Cash Available ledger as its own page. Every rupee
 * back in hand sits here: partial returns each get a row the day they
 * are recorded, and a release posts TWO rows on release day — principal
 * received and interest collected — split so the counter sees the two
 * streams separately (source + notes columns say which is which).
 *
 * Nothing extra is stored for this: the page derives its rows from the
 * released collaterals and payments, so any release is on the page the
 * moment the books change. The total at the bottom always ties to the
 * dashboard's Total Cash Available insight.
 */

/** One money-in-hand row — a partial return or a release's two legs
    (principal received / interest collected). */
interface CashRow {
  key: string;
  date: string | null | undefined; // a release's date can be unrecorded
  amount: number;
  source: string;
  who: string;
  notes: string;
}

export default function Cash() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [partials, setPartials] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchEntries().then(setEntries);
    fetchPartials().then(setPartials);
  }, []);

  // Build the cash rows from the same records the dashboard uses —
  // one row per partial return, two rows per released collateral.
  const rows = useMemo(() => {
    const byGroup = new Map<number, Entry[]>();
    for (const e of entries) {
      if (!byGroup.has(e.groupId)) byGroup.set(e.groupId, []);
      byGroup.get(e.groupId)!.push(e);
    }

    const out: CashRow[] = [];

    // Partial returns: money that came back before the release.
    for (const p of partials) {
      const subs = byGroup.get(p.groupId) ?? [];
      const g = subs[0];
      out.push({
        key: `p-${p.id}`,
        date: p.date,
        amount: p.amount,
        source: "Partial return",
        who: `${g?.customerName ?? "?"} · ${g?.item ?? "?"}`,
        notes: p.notes || "",
      });
    }

    // Releases: the two entries — principal and interest — on release day.
    for (const [groupId, subs] of byGroup) {
      const released = subs.filter((s) => s.status === "Released");
      if (released.length === 0) continue;
      const primary = subs.reduce((a, b) => (a.date <= b.date ? a : b));
      // All lends of one release share the date; take the latest recorded.
      const date = released.map((s) => s.releasedDate).filter(Boolean).sort().at(-1);
      const principal = released.reduce(
        (s, x) => s + (x.amountReturned ?? x.amount) - (x.interestCollected ?? 0),
        0
      );
      const interest = released.reduce((s, x) => s + (x.interestCollected ?? 0), 0);
      const who = `${primary.customerName} · ${primary.item}`;
      out.push({
        key: `r-${groupId}-principal`,
        date,
        amount: principal,
        source: "Release · principal",
        who,
        notes: primary.notes || "",
      });
      out.push({
        key: `r-${groupId}-interest`,
        date,
        amount: interest,
        source: "Release · interest",
        who,
        notes: "",
      });
    }

    // Newest day first; within one release principal sits above interest.
    return out.sort(
      (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.key.localeCompare(b.key)
    );
  }, [entries, partials]);

  // Search over the source text, who paid and the notes.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => !q || `${r.source} ${r.who} ${r.notes}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

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
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.key} className="hover:bg-tint even:bg-tint/40">
                <td className="px-3 py-2 text-xs text-slate">{shortDate(r.date)}</td>
                <td className="px-3 py-2">
                  <span className={r.source.startsWith("Release · interest") ? "text-primary" : "text-ink"}>
                    {r.source}
                  </span>
                  <span className="text-slate"> — {r.who}</span>
                </td>
                <td className="px-3 py-2 text-right text-ink">{money(r.amount)}</td>
                <td className="px-3 py-2 text-slate">{r.notes || "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted">
                  No cash entries yet — they appear here as money comes back.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}