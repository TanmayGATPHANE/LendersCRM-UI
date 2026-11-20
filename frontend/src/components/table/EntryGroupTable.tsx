import { useState } from "react";
import type { CollateralGroup, Entry } from "../../api/types.ts";
import type { MenuItem } from "../DotsMenu.tsx";
import DotsMenu from "../DotsMenu.tsx";
import StatusBadge from "../StatusBadge.tsx";
import { Field } from "../Field.tsx";
import GroupHistory from "./GroupHistory.tsx";
import GroupRow from "./GroupRow.tsx";
import { Skeleton, SkeletonRows, SkeletonCards } from "../Skeleton.tsx";
import type { FlashHint } from "./FlashTr.tsx";
import { money, shortDate } from "../../utils/format.ts";
import { buildLedger } from "../../utils/ledger.ts";
import { groupRateText } from "../../utils/grouping.ts";

/**
 * EntryGroupTable — the collateral-groups table (one row per collateral),
 * shared by the Dashboard and the customer History modal, so both look
 * and behave the same: click the customer name to expand a group's full
 * lend + partial-return history.
 *
 * groups   — group objects from utils/grouping.js buildGroups()
 * actions  — optional function(group) -> DotsMenu items; when absent the
 *            table renders without the Actions column (read-only).
 * loading  — while the books load, grey blocks stand where the rows will;
 *            the empty state appears only once the data has arrived.
 * showReleased — when false (the Active tab) the Released column drops
 *            out: on still-open collateral it only ever says "—".
 * onEditEntry — optional callback(entry) for editing one individual lend
 *            (a sub-lend too) from its row in the expanded ledger.
 */
interface Props {
  groups: CollateralGroup[];
  /** Per-group ⋮ items; absent → no Actions column (read-only view). */
  actions?: (group: CollateralGroup) => MenuItem[];
  /** The books are loading — grey rows stand in until they arrive. */
  loading?: boolean;
  /** Show the Released column? (Active tab: no — nothing is released.) */
  showReleased?: boolean;
  /** Which status tab the table is on: Released → the Rate column swaps
      to Interest Earned (the frozen figures); Active/All → Rate. */
  statusTab?: "All" | "Active" | "Released";
  /** Edit one individual lend (a sub-lend too) from its ledger row. */
  onEditEntry?: (entry: Entry) => void;
  /** Delete one active lend (§4.9) — the page owns the confirmation. */
  onDeleteEntry?: (entry: Entry) => void;
  /** The last successful save (Dashboard only) — pulses that group's row. */
  flash?: FlashHint | null;
  /** The active sort (the header shows its arrow); ascending by date. */
  sort?: SortSpec;
  /** Header click: switch the sorted column (or flip its direction). */
  onSort?: (col: SortCol) => void;
}

/** The columns whose headers sort the table (click = toggle asc/desc). */
export type SortCol = "date" | "amount" | "customer" | "rate" | "interest" | "earned" | "total" | "status";
export type SortSpec = { col: SortCol; dir: "asc" | "desc" };

/** The interest a RELEASED group earned — the frozen figures of its lends. */
function earnedOf(g: CollateralGroup): number {
  return g.subs.reduce((s, x) => s + (x.interestCollected ?? 0), 0);
}

/** Excel-style column widths, remembered per browser: drag a header's
    right edge to resize, double-click the edge to reset. The key keeps
    the dashboard's (and the history modal's) arrangement between loads. */
const COL_WIDTH_KEY = "ams-groups-col-widths";

function loadColWidths(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(COL_WIDTH_KEY) ?? "{}") as Record<string, number>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch { return {}; }
}

const COL_MIN = 56;   // no column ever collapses away
const COL_MAX = 720;  // one column can't swallow the whole table

export default function EntryGroupTable({ groups, actions, loading = false, showReleased = true, statusTab = "All", onEditEntry, onDeleteEntry, flash, sort, onSort }: Props) {
  const [expand, setExpand] = useState<number[]>([]); // groupIds currently expanded
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadColWidths);

  /** Drag a header's right edge: the live width rides DIRECTLY on the
      DOM <th> (no re-render per mousemove; the table's auto layout
      re-balances the other columns immediately), anchored at the edge
      like Excel's — only the final width is committed on mouse-up. */
  function startColumnDrag(e: React.MouseEvent, col: string, th: HTMLTableCellElement): void {
    e.preventDefault();
    e.stopPropagation();
    const anchor = th.getBoundingClientRect().left; // resize FROM the edge
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent): void => {
      th.style.width = `${Math.max(COL_MIN, Math.min(COL_MAX, ev.clientX - anchor))}px`;
    };
    const onUp = (): void => {
      const final = parseFloat(th.style.width);
      if (final > 0) {
        setColWidths((prev) => {
          const next = { ...prev, [col]: final };
          try { localStorage.setItem(COL_WIDTH_KEY, JSON.stringify(next)); } catch { /* widths just don't persist */ }
          return next;
        });
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /** Double-click a header edge: that column returns to its content size. */
  function resetColumnDrag(col: string): void {
    setColWidths((prev) => {
      const next = { ...prev };
      delete next[col];
      try { localStorage.setItem(COL_WIDTH_KEY, JSON.stringify(next)); } catch { /* widths just don't persist */ }
      return next;
    });
  }

  /** Flip one group between expanded and collapsed. */
  function toggle(id: number): void {
    setExpand((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // The column budget: Date · Principal Amount · Customer · Item · Rate ·
  // Interest (Active/All) OR Rate→Interest Earned (Released) · Total
  // (All/Released — nothing is collected on Active) · Status
  // (+ Released when shown) (+ Actions), and the expanded ledger row
  // spans exactly what the headline row shows.
  const colSpan = 6 + (statusTab === "Released" ? 0 : 1) + (showReleased ? 2 : 0) + (actions ? 1 : 0);

  // text-left matters: <th> defaults to centered. Layout is content-
  // sized; every header carries a drag handle (except the ⋮-only one).
  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted relative";

  /** The header's resize handle: grab the right edge to drag, double-
      click to reset. Stops propagation so sorting never fires. */
  function resizeHandle(col: string) {
    return (
      <span
        onMouseDown={(e) => e.currentTarget.parentElement && startColumnDrag(e, col, e.currentTarget.parentElement as HTMLTableCellElement)}
        onDoubleClick={(e) => { e.stopPropagation(); resetColumnDrag(col); }}
        onClick={(e) => e.stopPropagation()}
        title="Drag to resize · double-click to reset"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 transition-colors duration-150"
        aria-hidden="true"
      />
    );
  }

  /** A sortable header: click cycles asc → desc → asc (per column, the
      other columns' arrows do not move it off its own toggle). */
  function sortable(col: SortCol, label: string) {
    const active = sort?.col === col;
    const wide = colWidths[col];
    return (
      <th
        onClick={onSort ? () => onSort(col) : undefined}
        style={wide ? { width: `${wide}px` } : undefined}
        className={`${th} ${onSort ? "cursor-pointer select-none hover:text-ink transition-colors duration-300 ease-brand" : ""}`}
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {label}
          <i
            className={`ph ${active ? (sort?.dir === "asc" ? "ph-caret-up" : "ph-caret-down") : "ph-caret-up-down"} text-xs ${
              active ? "text-primary" : "text-dim"
            }`}
            aria-hidden="true"
          />
        </span>
        {resizeHandle(col)}
      </th>
    );
  }

  /** A plain (non-sorting) header, resizable like the rest. The Actions
      header shows its word above the row's ⋮ dots. */
  function header(col: string, label: string, className = "") {
    const wide = colWidths[col];
    return (
      <th
        style={wide ? { width: `${wide}px` } : undefined}
        className={`${th} ${className} whitespace-nowrap`}
      >
        {label}
        {resizeHandle(col)}
      </th>
    );
  }

  return (
    <>
      {/* Mobile: each collateral as a card (under md) */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {loading ? <SkeletonCards count={5} /> : (
        <>
        {groups.map((g) => (
          <GroupCard
            key={g.groupId}
            group={g}
            expanded={expand.includes(g.groupId)}
            onToggle={() => toggle(g.groupId)}
            actions={actions}
            onEditEntry={onEditEntry}
          />
        ))}
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-12 text-center">
            <i className="ph ph-package text-2xl text-dim" aria-hidden="true" />
            <span className="text-sm text-slate">No collaterals match</span>
            <span className="text-xs text-muted">
              Nothing matches the search / filters — try clearing them, or add an entry.
            </span>
          </div>
        )}
        </>
        )}
      </div>

      {/* Desktop table: content-sized layout; every header carries the
          Excel drag handle (right edge) — drag to resize, double-click
          to reset, the arrangement is remembered per browser. */}
      <table className="hidden w-full text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          {sortable("date", "Date")}
          {sortable("amount", "Principal Amount")}
          {sortable("customer", "Customer")}
          {header("item", "Collateral Item")}
          {/* Released tab: the earned interest instead of the rate — what
              the collateral actually brought back before release day.
              Active / All: the Rate column STAYS and an Interest column
              joins it (outstanding accrued on active, frozen on released
              rows — one live figure per collateral). */}
          {statusTab === "Released"
            ? sortable("earned", "Interest Earned")
            : (
              <>
                {sortable("rate", "Rate")}
                {sortable("interest", "Interest")}
              </>
            )}
          {/* Total: what was collected on the collateral (release day cash).
              Only where collection happens — the All and Released tabs; the
              Active tab's book is all still out. */}
          {showReleased && sortable("total", "Total")}
          {sortable("status", "Status")}
          {showReleased && header("released", "Released")}
          {actions && header("actions", "Actions")}
        </tr>
      </thead>
      <tbody className="stagger divide-y divide-line">
        {loading ? (
          <SkeletonRows rows={8} cols={colSpan} />
        ) : (
        <>
        {groups.map((g) => (
          <GroupRow
            key={g.groupId}
            group={g}
            expanded={expand.includes(g.groupId)}
            onToggle={() => toggle(g.groupId)}
            actions={actions}
            showReleased={showReleased}
            showInterestEarned={statusTab === "Released"}
            showInterest={statusTab !== "Released"}
            onEditEntry={onEditEntry}
            onDeleteEntry={onDeleteEntry}
            flash={flash}
          />
        ))}
        {groups.length === 0 && (
          <tr>
            <td colSpan={colSpan} className="px-3 py-12">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <i className="ph ph-package text-2xl text-dim" aria-hidden="true" />
                <span className="text-sm text-slate">No collaterals match</span>
                <span className="text-xs text-muted">
                  Nothing matches the search / filters — try clearing them, or add an entry.
                </span>
              </div>
            </td>
          </tr>
        )}
        </>
        )}
      </tbody>
    </table>
    </>
  );
}

/** GroupCard — one collateral group as a phone-size card: who + what and
    the badge up top, the three money columns as a field grid, the ⋮ menu
    bottom-right, and the full passbook inline when expanded. */
function GroupCard({ group: g, expanded, onToggle, actions, onEditEntry }: {
  group: CollateralGroup;
  expanded: boolean;
  onToggle: () => void;
  actions?: (group: CollateralGroup) => MenuItem[];
  onEditEntry?: (entry: Entry) => void;
}) {
  const collected = g.subs.reduce((s, x) => s + (x.amountReturned ?? x.amount), 0);
  const totalText =
    g.status === "Released"
      ? money(g.primary.totalCollected ?? collected)
      : money(g.primary.amount);
  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
      {/* Who + what (tap to expand) and the status badge */}
      <div className="flex items-start justify-between gap-2">
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-ink">
            {g.customerName}
            {g.customerAddress && (
              <span className="ml-1.5 text-xs font-normal text-muted">· {g.customerAddress}</span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate">
            {shortDate(g.date)} · {g.item}
            <i
              className={`ph ph-caret-down text-sm text-dim transition-transform duration-300 ease-brand ${
                expanded ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </span>
        </button>
        <StatusBadge status={g.status} />
      </div>

      {/* The money columns */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label={g.status === "Released" ? "Collected" : "Amanat"}>
          <span className="inline-flex items-center gap-1">
            {totalText}
            {g.status !== "Released" && g.subs.length > 1 && (
              <span className="rounded bg-tint px-1.5 py-0.5 text-xs font-medium text-primary">
                +{g.subs.length - 1}
              </span>
            )}
          </span>
        </Field>
        <Field label="Rate" tone="muted">{groupRateText(g) || "—"}</Field>
      </div>

      {/* Released date + the row actions */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted">
          {g.status === "Released" ? `Released ${shortDate(g.primary.releasedDate)}` : ""}
        </span>
        {actions && (
          // stopPropagation: the ⋮ must not flip the card's expansion
          <span onClick={(e) => e.stopPropagation()}>
            <DotsMenu items={actions(g)} />
          </span>
        )}
      </div>

      {/* Expanded: the audit trail (Admin) + the passbook the desktop
          row reveals */}
      {expanded && (
        <>
          <GroupHistory groupId={g.groupId} />
          <MobileLedger group={g} onEditEntry={onEditEntry} />
        </>
      )}
    </div>
  );
}

/** MobileLedger — the group's passbook as a stacked list (LedgerTable's
    rows, one movement per line, running total closing). */
function MobileLedger({ group: g, onEditEntry }: {
  group: CollateralGroup;
  onEditEntry?: (entry: Entry) => void;
}) {
  const { rows, balance, interest } = buildLedger(g);
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-tint/60 p-2.5">
      {rows.map((r) => {
        const entry = g.subs.find((s) => s.id === r.id);
        return (
          <div key={r.key} className="flex items-start justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="text-slate">
                {shortDate(r.date)} <span className="text-muted">· {r.untilText}</span>
              </p>
              {r.notes && <p className="truncate text-muted">{r.notes}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-right">
              <div>
                <p className={r.isReceived ? "text-red-600" : "text-ink"}>
                  {r.isReceived ? `−${money(r.amount)}` : money(r.amount)}
                </p>
                {r.interest ? <p className="text-muted">int {money(r.interest)}</p> : null}
              </div>
              {r.kind === "lend" && r.status === "Active" && onEditEntry && entry && (
                <button
                  onClick={() => onEditEntry(entry)}
                  title="Edit this lend"
                  className="rounded p-1 text-muted hover:bg-tint-hover hover:text-primary
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                             transition-colors duration-300 ease-brand"
                >
                  <i className="ph ph-pencil-simple text-sm" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        );
      })}
      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-line pt-2 text-xs font-medium text-ink">
          <span className="uppercase tracking-wider text-muted">Running</span>
          <span className="tabular-nums">
            {money(balance)}
            {interest ? <span className="font-normal text-muted"> · int {money(interest)}</span> : null}
          </span>
        </div>
      )}
    </div>
  );
}