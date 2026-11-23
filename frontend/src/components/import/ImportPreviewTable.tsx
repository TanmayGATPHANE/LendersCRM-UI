import { useState } from "react";
import type { ImportPreview } from "../../api/types.ts";
import StatusBadge from "../StatusBadge.tsx";
import { money, shortDate } from "../../utils/format.ts";

/**
 * ImportPreviewTable — the full-page review of a parsed Excel sheet.
 *
 * Shaped like the Dashboard's Grid view: one row per movement (a lend or
 * an inline partial return), a per-column filter row, dense cells and a
 * sticky totals footer — so a year-sized sheet is checked the same way
 * the daily grid is read. Read-only on purpose: nothing here can be
 * edited; the Import page's confirm button is the only way the parse
 * reaches the books.
 *
 * Row is the ORIGINAL sheet row (provenance — it is also what the commit's
 * Notes stamp records, so a mismatch is easy to trace back to Excel).
 */
interface Props {
  preview: ImportPreview;
  /** %/month every imported lend gets — the Import page's rate field. */
  rate: number | null;
}

/** One parsed money row, flattened for the grid. */
interface Movement {
  key: string;
  row: number;
  date: string;
  type: "Lend" | "Return";
  customer: string;
  item: string;
  lend: number | null;
  received: number | null;
  rate: number | null;
  /** Released sheet only: the interest this lend brought back. */
  interest: number | null;
  status: "Active" | "Released";
  released: string | null;
  notes: string | null;
}

export default function ImportPreviewTable({ preview, rate }: Props) {
  // Per-column filter text (Excel-style), ANDed — the same interaction the
  // Dashboard grid offers, so checking a big sheet feels identical.
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  const released = preview.kind === "Released";
  // Column order drives the header, the filter row and the matching text.
  const COLS = released
    ? ["row", "date", "type", "customer", "item", "lend", "rate", "interest", "status", "released", "notes"]
    : ["row", "date", "type", "customer", "item", "lend", "received", "rate", "status", "notes"];

  // Flatten groups -> one row per lend / partial return, in SHEET order.
  const rows: Movement[] = preview.groups
    .flatMap((g) => [
      ...g.lends.map<Movement>((l) => ({
        key: `l-${l.row}`,
        row: l.row,
        date: l.date,
        type: "Lend",
        customer: g.name,
        item: g.item,
        lend: l.amount,
        received: null,
        rate,
        interest: released ? (l.interest ?? 0) : null,
        status: preview.kind,
        released: l.releasedDate,
        notes: null,
      })),
      ...g.returns.map<Movement>((r) => ({
        key: `r-${r.row}`,
        row: r.row,
        date: r.date,
        type: "Return",
        customer: g.name,
        item: g.item,
        lend: null,
        received: r.amount,
        rate: null,
        interest: null,
        status: preview.kind,
        released: null,
        notes: r.notes,
      })),
    ])
    .sort((a, b) => a.row - b.row);

  /** Every searchable spelling of one column of one row. */
  function colText(r: Movement, col: string): string {
    switch (col) {
      case "row": return String(r.row);
      case "date": return `${r.date} ${shortDate(r.date)}`;
      case "type": return r.type;
      case "customer": return r.customer;
      case "item": return r.item;
      case "lend": return r.lend != null ? String(r.lend) : "";
      case "received": return r.received != null ? String(r.received) : "";
      case "rate": return r.rate != null ? String(r.rate) : "";
      case "interest": return r.interest != null ? String(r.interest) : "";
      case "status": return r.status;
      case "released": return r.released ?? "";
      case "notes": return r.notes ?? "";
      default: return "";
    }
  }

  const visible = rows.filter((r) =>
    Object.entries(colFilters).every(
      ([col, q]) => !q || colText(r, col).toLowerCase().includes(q.toLowerCase())
    )
  );

  const sum = (pick: (r: Movement) => number | null) =>
    visible.reduce((s, r) => s + (pick(r) ?? 0), 0);
  const lent = sum((r) => r.lend);
  const received = sum((r) => r.received);
  const interest = sum((r) => r.interest);

  // Dense spreadsheet skin, locked widths, Notes absorbs the rest.
  const th = "px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wider text-muted";
  const thR = `${th} text-right`;
  const cell = "px-3 py-1 text-xs text-slate truncate";
  const cellR = `${cell} text-right`;

  return (
    <table className="w-full table-fixed min-w-[1120px] text-sm">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[7%]`}>Row</th>
          <th className={`${th} w-[9%]`}>Date</th>
          <th className={`${th} w-[6%]`}>Type</th>
          <th className={`${th} w-[12%]`}>Customer</th>
          <th className={`${th} w-[13%]`}>Item</th>
          <th className={`${thR} w-[8%]`}>Lend</th>
          {!released && <th className={`${thR} w-[8%]`}>Received</th>}
          <th className={`${thR} w-[7%]`}>Rate</th>
          {released && <th className={`${thR} w-[7%]`}>Earned</th>}
          <th className={`${th} w-[8%]`}>Status</th>
          {released && <th className={`${th} w-[9%]`}>Released</th>}
          <th className={`${th} w-[8%]`}>Notes</th>
        </tr>
        {/* Per-column filters, exactly where the Dashboard grid puts them. */}
        <tr>
          {COLS.map((col) => (
            <th key={col} className="px-3 pb-1.5 font-normal">
              <input
                value={colFilters[col] ?? ""}
                onChange={(e) => setColFilters({ ...colFilters, [col]: e.target.value })}
                placeholder="Filter…"
                title={`Filter by ${col}`}
                className="w-full rounded border border-line bg-tint px-1.5 py-0.5 text-xs font-normal focus:border-primary focus:outline-none"
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {visible.map((r) => (
          <tr key={r.key} className="hover:bg-tint even:bg-tint/40">
            <td className={`${cell} text-muted/70`}>{r.row}</td>
            <td className={`${cell} whitespace-nowrap`}>{shortDate(r.date)}</td>
            <td className={`${cell} ${r.type === "Return" ? "text-red-600" : ""}`}>{r.type}</td>
            <td className={`${cell} text-ink`}>
              {r.customer || <em className="text-muted">no name</em>}
            </td>
            <td className={cell}>{r.item || <em className="text-muted">no item</em>}</td>
            <td className={`${cellR} text-ink`}>{r.lend != null ? money(r.lend) : "—"}</td>
            {!released && (
              <td className={`${cellR} ${r.received != null ? "text-red-600" : ""}`}>
                {r.received != null ? money(r.received) : "—"}
              </td>
            )}
            <td className={cellR}>{r.rate != null ? `${r.rate}%/mo` : "—"}</td>
            {released && (
              <td className={`${cellR} text-green-700`}>
                {r.interest != null ? money(r.interest) : "—"}
              </td>
            )}
            <td className={cell}><StatusBadge status={r.status} /></td>
            {released && <td className={`${cell} whitespace-nowrap text-muted`}>{shortDate(r.released)}</td>}
            <td className={cell}>{r.notes || <span className="text-muted/50">—</span>}</td>
          </tr>
        ))}
        {visible.length === 0 && (
          <tr>
            <td colSpan={COLS.length} className="px-3 py-12">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <i className="ph ph-table text-2xl text-dim" aria-hidden="true" />
                <span className="text-sm text-slate">No rows in the preview</span>
                <span className="text-xs text-muted">
                  {rows.length === 0
                    ? "The parser found no lend rows on this sheet — see the warnings above."
                    : "Nothing matches the column filters — clear them to see the whole parse."}
                </span>
              </div>
            </td>
          </tr>
        )}
      </tbody>
      {visible.length > 0 && (
        <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
          <tr className="text-xs">
            <td colSpan={5} className="px-3 py-1.5 font-medium uppercase tracking-wider text-muted">
              {visible.length} of {rows.length} rows
            </td>
            <td className="px-3 py-1.5 text-right font-medium text-ink" title="Lent in the visible rows">
              {money(lent)}
            </td>
            {!released && (
              <td className="px-3 py-1.5 text-right font-medium text-red-600" title="Returned in the visible rows">
                {money(received)}
              </td>
            )}
            <td />
            {released && (
              <td className="px-3 py-1.5 text-right font-medium text-green-700" title="Interest earned in the visible rows">
                {money(interest)}
              </td>
            )}
            <td colSpan={released ? 3 : 2} />
          </tr>
        </tfoot>
      )}
    </table>
  );
}
