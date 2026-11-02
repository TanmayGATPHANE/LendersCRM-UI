import { useState } from "react";
import type { CollateralGroup, Entry } from "../../api/types.ts";
import type { MenuItem } from "../DotsMenu.tsx";
import DotsMenu from "../DotsMenu.tsx";
import StatusBadge from "../StatusBadge.tsx";
import { Field } from "../Field.tsx";
import GroupHistory from "./GroupHistory.tsx";
import GroupRow from "./GroupRow.tsx";
import type { FlashHint } from "./FlashTr.tsx";
import { money, shortDate } from "../../utils/format.ts";
import { buildLedger } from "../../utils/ledger.ts";
import { groupRateText, groupInterest } from "../../utils/grouping.ts";

/**
 * EntryGroupTable — the collateral-groups table (one row per collateral),
 * shared by the Dashboard and the customer History modal, so both look
 * and behave the same: click the customer name to expand a group's full
 * lend + partial-return history.
 *
 * groups   — group objects from utils/grouping.js buildGroups()
 * actions  — optional function(group) -> DotsMenu items; when absent the
 *            table renders without the Actions column (read-only).
 * onEditEntry — optional callback(entry) for editing one individual lend
 *            (a sub-lend too) from its row in the expanded ledger.
 */
interface Props {
  groups: CollateralGroup[];
  /** Per-group ⋮ items; absent → no Actions column (read-only view). */
  actions?: (group: CollateralGroup) => MenuItem[];
  /** Edit one individual lend (a sub-lend too) from its ledger row. */
  onEditEntry?: (entry: Entry) => void;
  /** The last successful save (Dashboard only) — pulses that group's row. */
  flash?: FlashHint | null;
}

export default function EntryGroupTable({ groups, actions, onEditEntry, flash }: Props) {
  const [expand, setExpand] = useState<number[]>([]); // groupIds currently expanded

  /** Flip one group between expanded and collapsed. */
  function toggle(id: number) {
    setExpand((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // text-left matters: <th> defaults to centered. table-fixed + width
  // percentages lock the grid so expanding a row can never move the
  // other columns — the header stays in sync with the data at all times.
  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";
  const thR = `${th} text-right`;

  return (
    <>
      {/* Mobile: each collateral as a card (under md) */}
      <div className="stagger space-y-2 p-3 md:hidden">
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
      </div>

      {/* Desktop: the fixed-column table (from md up) */}
      <table className="hidden w-full table-fixed min-w-[820px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[10%]`}>Date</th>
          <th className={`${th} w-[16%]`}>Customer Name</th>
          <th className={`${th} w-[19%]`}>Collateral Item</th>
          <th className={`${thR} w-[12%]`}>Amount</th>
          <th className={`${thR} w-[7%]`}>Rate</th>
          <th className={`${thR} w-[10%]`}>Interest</th>
          <th className={`${th} w-[10%]`}>Status</th>
          <th className={`${th} w-[8%]`}>Released</th>
          {actions && <th className={`${thR} w-[8%]`}>Actions</th>}
        </tr>
      </thead>
      <tbody className="stagger divide-y divide-line">
        {groups.map((g) => (
          <GroupRow
            key={g.groupId}
            group={g}
            expanded={expand.includes(g.groupId)}
            onToggle={() => toggle(g.groupId)}
            actions={actions}
            onEditEntry={onEditEntry}
            flash={flash}
          />
        ))}
        {groups.length === 0 && (
          <tr>
            <td colSpan={actions ? 9 : 8} className="px-3 py-12">
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

      {/* The three money columns */}
      <div className="mt-3 grid grid-cols-3 gap-2">
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
        <Field label="Interest" tone="muted">
          {g.subs.every((s) => !s.rate) && g.status === "Active" ? "—" : money(groupInterest(g))}
        </Field>
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