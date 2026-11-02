import { useState, type ReactNode } from "react";
import type { CollateralGroup, Customer, EntryStatus } from "../../api/types.ts";
import StatusBadge from "../StatusBadge.tsx";
import { Field } from "../Field.tsx";
import FlashTr, { type FlashHint } from "./FlashTr.tsx";
import { money, shortDate } from "../../utils/format.ts";
import { interestFor } from "../../utils/interest.ts";

/**
 * GridTable — the flat, spreadsheet-style view (Compass / Excel kind).
 * Rows are grouped BY CUSTOMER (alphabetical); inside each customer,
 * lends and payments line up in date order — not by date alone.
 *
 * Data columns are editable in the cell, like Excel: click a cell, it
 * becomes an input; Enter or clicking away commits, Escape cancels.
 *   - Date / Item / Amount / Rate / Notes — edit that one lend (payments
 *     expose Date / Amount / Notes).
 *   - Customer — moves the WHOLE collateral group to another customer,
 *     because a collateral belongs to one person: its lends and payments
 *     always travel together (see updateGroupCustomer in the API).
 *   - Paid / Interest / Type / Status are computed or lifecycle data —
 *     read-only on purpose (paid changes via Partial Return).
 *
 * groups — group objects from buildGroups(), already filtered; only the
 *          presentation differs from the grouped view.
 * customers — the customer list for the Customer dropdown.
 * readOnly — view-only role: every cell is inert.
 * onUpdate(lendId, patch)      — commit edits on a lend row.
 * onPaymentUpdate(id, patch)   — commit edits on a payment row.
 * onCustomerMove(groupId, customerId) — move one whole group.
 */

/** Patch for a lend-row cell commit — the raw (still string) values ride
    through; the API layer coerces them to numbers (§6 note). */
interface LendPatch {
  date?: string;
  item?: string;
  amount?: string | number;
  rate?: string | number | null;
  notes?: string;
}

/** Patch for a payment-row cell commit (no item/rate — those belong to
    the lends). */
interface PaymentPatch {
  date?: string;
  amount?: string | number;
  notes?: string;
}

/** One flattened row of the grid — either a lend or a partial return;
    the fields each kind doesn't carry stay optional here. */
interface GridRow {
  key: string;
  id: number;
  kind: "lend" | "payment";
  groupId: number;
  date: string;
  type: "Lend" | "Payment"; // the Type column's display text
  customerId: number;
  customer: string;
  customerAddress: string;
  item: string; // display
  amount: number; // the editable value behind the input
  /** Lend rows — the formatted amount for the Lend column. */
  amountText?: string;
  /** Payment rows — the Lend column's "—" placeholder. */
  lend?: string;
  received: string; // the Received column's display text ("—" on lends)
  rate: number | null;
  interest: string; // pre-formatted display text
  status: EntryStatus | null; // payments carry null
  released: string | null; // ISO released date, payments carry null
  notes: string;
  editable: boolean;
}

interface Props {
  groups: CollateralGroup[];
  customers: Customer[];
  /** View-only role: every cell renders inert. */
  readOnly?: boolean;
  /** Commit cell edits on a lend row. */
  onUpdate: (id: number, patch: LendPatch) => void | Promise<void>;
  /** Commit cell edits on a payment row. */
  onPaymentUpdate: (id: number, patch: PaymentPatch) => void | Promise<void>;
  onCustomerMove: (groupId: number, customerId: number) => void | Promise<void>;
  /** The last successful save — pulses every row of that collateral. */
  flash?: FlashHint | null;
}

export default function GridTable({ groups, customers, readOnly = false, onUpdate, onPaymentUpdate, onCustomerMove, flash }: Props) {
  // Per-column filter text (Excel-style): each column filters its own
  // rows with a contains-match, all filters combine with AND.
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  // The filterable columns, in order — drives the filter row + matching.
  const COLS = ["date", "type", "customer", "item", "lend", "received", "rate", "interest", "status", "released", "notes"];
  // A lend/payment commits through the right API given its row kind.
  const save =
    (r: GridRow) =>
    (patch: LendPatch | PaymentPatch) =>
      r.kind === "payment" ? onPaymentUpdate(r.id, patch) : onUpdate(r.id, patch);

  // Flatten groups -> individual rows, one per lend / partial return.
  const rows: GridRow[] = groups
    .flatMap((g) => [
      ...g.subs.map<GridRow>((s) => ({
        key: `l-${s.id}`,
        id: s.id,
        kind: "lend",
        groupId: g.groupId,
        date: s.date,
        type: "Lend",
        customerId: g.customerId,
        customer: g.customerName,
        customerAddress: g.customerAddress ?? "",
        item: s.item || g.item,
        amount: s.amount, // number — the editable value
        amountText: money(s.amount),
        received: "—", // lend rows have nothing in the Received column
        rate: s.rate ?? null,
        interest: money(interestFor(s)),
        status: s.status,
        released: s.releasedDate ?? null,
        notes: s.notes || "",
        editable: s.status === "Active" && !readOnly, // released lends are read-only history
      })),
      ...g.partials.map<GridRow>((p) => ({
        key: `p-${p.id}`,
        id: p.id,
        kind: "payment",
        groupId: g.groupId,
        date: p.date,
        type: "Payment",
        customerId: g.customerId,
        customer: g.customerName,
        customerAddress: g.customerAddress ?? "",
        item: g.item, // display only — the item belongs to the lends
        amount: p.amount,
        lend: "—", // payments never sit in the Lend column
        received: money(p.amount), // what came back, in its own column
        rate: null,
        interest: "—",
        status: null,
        released: null,
        notes: p.notes || "",
        editable: !readOnly, // a payment's date/amount/notes can be corrected
      })),
    ])
    // Customer alphabetically; within one customer by date, lends first
    // on a tie (their story reads top-to-bottom like a passbook).
    .sort(
      (a, b) =>
        a.customer.localeCompare(b.customer) ||
        a.date.localeCompare(b.date) ||
        (a.type === "Lend" ? 0 : 1) - (b.type === "Lend" ? 0 : 1)
    );

  // Locked column widths (table-fixed); Notes absorbs whatever is left.
  const th = "px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wider text-muted";
  const thR = `${th} text-right`;
  const cell = "px-3 py-1 text-xs text-slate truncate"; // dense grid cell
  const cellR = `${cell} text-right`;

  /** Every searchable spelling of one column of one row. */
  function colText(r: GridRow, col: string): string {
    switch (col) {
      case "date": return `${r.date} ${shortDate(r.date)}`;
      case "type": return r.type;
      case "customer": return `${r.customer} ${r.customerAddress}`;
      case "item": return r.item;
      case "lend": return r.kind === "lend" ? String(r.amount) : "";
      case "received": return r.kind === "payment" ? String(r.amount) : "";
      case "rate": return r.rate != null ? String(r.rate) : "";
      case "interest": return r.interest;
      case "status": return r.status ?? "";
      case "released": return r.released ?? "";
      case "notes": return r.notes;
      default: return "";
    }
  }

  /** Does this row pass every set column filter (AND)? */
  const passesFilters = (r: GridRow) =>
    Object.entries(colFilters).every(
      ([col, q]) =>
        !q ||
        colText(r, col).toLowerCase().includes(String(q).toLowerCase())
    );

  const visible = rows.filter(passesFilters); // filters hit the totals too

  return (
    <>
      {/* Mobile: one card per movement, newest passbook order kept */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {visible.map((r) => (
          <GridCard key={r.key} r={r} />
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-12 text-center">
            <i className="ph ph-table text-2xl text-dim" aria-hidden="true" />
            <span className="text-sm text-slate">No entries in the grid</span>
            <span className="text-xs text-muted">
              Nothing matches the search / filters — try clearing them, or add an entry.
            </span>
          </div>
        )}
      </div>

      {/* Desktop: the flat editable spreadsheet (from md up) */}
      <table className="hidden w-full table-fixed min-w-[1080px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[8%]`}>Date</th>
          <th className={`${th} w-[6%]`}>Type</th>
          <th className={`${th} w-[12%]`}>Customer</th>
          <th className={`${th} w-[12%]`}>Item</th>
          {/* Lend = what went out; Received = what came back (payments) */}
          <th className={`${thR} w-[9%]`}>Lend</th>
          <th className={`${thR} w-[9%]`}>Received</th>
          <th className={`${thR} w-[5%]`}>Rate</th>
          <th className={`${thR} w-[8%]`}>Interest</th>
          <th className={`${th} w-[7%]`}>Status</th>
          {/* Release date: when the collateral went back (grids only) */}
          <th className={`${th} w-[8%]`}>Released</th>
          <th className={th}>Notes</th>
        </tr>
        {/* Per-column filter row — Excel-style, under the header labels */}
        <tr>
          {COLS.map((col) => (
            <th key={col} className="px-2 pb-1.5 font-normal">
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
      <tbody className="stagger divide-y divide-line">
        {visible.map((r) => {
          const patch = save(r); // commit for THIS row
          const lendOnly = r.editable && r.kind === "lend";
          return (
            <FlashTr key={r.key} flash={flash} groupId={r.groupId}
              className="hover:bg-tint even:bg-tint/40">
              <EditCell
                text={shortDate(r.date)} value={r.date} type="date"
                disabled={!r.editable}
                className={`${cell} text-muted`}
                onCommit={(v) => patch({ date: v })}
              />
              {/* Type column: lifecycle data, read-only */}
              <td className={`${cell} ${r.type === "Payment" ? "text-red-600" : ""}`}>
                {r.type}
              </td>
              <EditCell
                text={
                  // Name — the area rides beside it, never below it.
                  <span className="truncate">
                    {r.customer}
                    {r.customerAddress && (
                      <span className="text-xs text-dim"> · {r.customerAddress}</span>
                    )}
                  </span>
                }
                value={String(r.customerId)} type="select"
                disabled={readOnly}
                className={cell}
                options={customers.map((c) => ({ value: String(c.id), label: c.name }))}
                onCommit={(v) => v && onCustomerMove(r.groupId, Number(v))}
              />
              <EditCell
                text={r.item} value={r.item}
                disabled={!lendOnly} // payments show their group's item
                className={cell}
                onCommit={(v) => patch({ item: v })}
              />
              {/* Lend column: what went out — lends only */}
              <EditCell
                text={r.type === "Lend" ? r.amountText : "—"}
                value={r.amount} type="number"
                disabled={r.kind !== "lend" || !r.editable}
                className={`${cellR} text-ink`}
                onCommit={(v) => patch({ amount: v })}
              />
              {/* Received column: what came back — payments only */}
              <EditCell
                text={r.type === "Payment" ? r.received : "—"}
                value={r.amount} type="number"
                disabled={r.kind !== "payment"}
                className={cellR}
                onCommit={(v) => patch({ amount: v })}
              />
              <EditCell
                text={r.rate != null ? `${r.rate}%/mo` : "—"} value={r.rate ?? ""}
                type="number" allowEmpty // empty rate = interest-free
                disabled={!lendOnly}
                className={cellR}
                onCommit={(v) => patch({ rate: v === "" ? null : v })}
              />
              {/* Interest: computed live (§4.4), read-only */}
              <td className={cellR}>{r.interest}</td>
              <td className={cell}>{r.status ? <StatusBadge status={r.status} /> : "—"}</td>
              <td className={`${cell} text-muted whitespace-nowrap`}>{shortDate(r.released)}</td>
              <EditCell
                text={r.notes} value={r.notes} allowEmpty
                disabled={!r.editable}
                className={cell}
                onCommit={(v) => patch({ notes: v })}
              />
            </FlashTr>
          );
        })}
        {visible.length === 0 && (
          <tr>
            <td colSpan={11} className="px-3 py-12">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <i className="ph ph-table text-2xl text-dim" aria-hidden="true" />
                <span className="text-sm text-slate">No entries in the grid</span>
                <span className="text-xs text-muted">
                  Nothing matches the search / filters — try clearing them, or add an entry.
                </span>
              </div>
            </td>
          </tr>
        )}
      </tbody>
      {visible.length > 0 && (
        // Sticky sum row — totals of the rows that passed the filters.
        <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
          <tr className="text-xs">
            <td colSpan={4} className="px-3 py-1.5 font-medium uppercase tracking-wider text-muted">
              {visible.length} rows
            </td>
            <td className="px-3 py-1.5 text-right font-medium text-ink">
              {money(visible.filter((r) => r.type === "Lend").reduce((s, r) => s + r.amount, 0))}
            </td>
            <td className="px-3 py-1.5 text-right font-medium text-badge-ok">
              {money(visible.filter((r) => r.type === "Payment").reduce((s, r) => s + r.amount, 0))}
            </td>
            <td colSpan={5}></td>
          </tr>
        </tfoot>
      )}
    </table>
    </>
  );
}

/** GridCard — one lend / partial return as a phone-size card (the grid's
    flat rows, read-only on mobile: cell edits stay a desktop gesture). */
function GridCard({ r }: { r: GridRow }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">
            {r.customer}
            {r.customerAddress && (
              <span className="ml-1.5 text-xs font-normal text-muted">· {r.customerAddress}</span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate">{r.item}</span>
        </div>
        {r.status ? <StatusBadge status={r.status} /> : (
          <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
            {r.type}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field label={r.type === "Payment" ? "Received" : "Lent"}
               tone={r.type === "Payment" ? "out" : "ink"}>
          {r.type === "Payment" ? `−${r.received}` : r.amountText ?? "—"}
        </Field>
        <Field label="Rate" tone="muted">{r.rate != null ? `${r.rate}%/mo` : "—"}</Field>
        <Field label="Interest" tone="muted">{r.interest || "—"}</Field>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">
          {shortDate(r.date)}
          {r.released ? ` · released ${shortDate(r.released)}` : ""}
          {r.notes ? ` · ${r.notes}` : ""}
        </span>
      </div>
    </div>
  );
}

/** EditCell — one spreadsheet cell. Shows `text` until clicked; then an
 * input of its `type` (text / number / date / select) edits the value.
 * Enter or clicking away commits, Escape cancels; unchanged or empty
 * (unless `allowEmpty`) commits nothing. `disabled` renders read-only.
 */
interface EditCellProps {
  /** Displayed value while the cell is closed (any node — the Customer
      cell renders a customer+area <span>). */
  text: ReactNode;
  /** The current value behind the cell; drives the "nothing changed" check. */
  value: string | number;
  type?: "text" | "number" | "date" | "select";
  /** <option>s for type="select". */
  options?: { value: string; label: string }[];
  /** Blank counts as a change (rate = null → interest-free). */
  allowEmpty?: boolean;
  disabled?: boolean;
  className: string;
  /** Commits the final draft string; the row decides the coercion. */
  onCommit: (value: string) => void;
}

function EditCell({ text, value, type = "text", options, allowEmpty = false, disabled = false, className, onCommit }: EditCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (disabled)
    return <td className={className}>{text}</td>;

  if (!open)
    return (
      <td
        className={`${className} cursor-pointer hover:bg-tint-hover/60`}
        title="Click to edit"
        onClick={() => { setDraft(String(value ?? "")); setOpen(true); }}
      >
        {text}
      </td>
    );

  /** Commit: numbers must parse; blank stays blank only if allowed. */
  function done() {
    setOpen(false);
    if (draft === String(value ?? "")) return; // nothing changed
    if (draft === "" && !(allowEmpty || type === "select")) return;
    if (type === "number" && !Number.isFinite(Number(draft))) return;
    onCommit(draft);
  }

  const inputCls =
    "w-full rounded border border-primary bg-tint px-1 py-0.5 text-xs focus:outline-none";

  return (
    <td className={className}>
      {type === "select" ? (
        // Choosing a customer commits and closes immediately.
        <select
          autoFocus
          value={draft}
          onChange={(e) => { setDraft(e.target.value); onCommit(e.target.value); setOpen(false); }}
          onBlur={() => setOpen(false)}
          className={inputCls}
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={done}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur(); // blur = commit
            if (e.key === "Escape") setOpen(false);
          }}
          className={inputCls}
        />
      )}
    </td>
  );
}