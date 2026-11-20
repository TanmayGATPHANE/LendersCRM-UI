import type { CollateralGroup, Entry } from "../../api/types.ts";
import type { MenuItem } from "../DotsMenu.tsx";
import DotsMenu from "../DotsMenu.tsx";
import StatusBadge from "../StatusBadge.tsx";
import FlashTr, { type FlashHint } from "./FlashTr.tsx";
import GroupHistory from "./GroupHistory.tsx";
import LedgerTable from "./LedgerTable.tsx";
import { money, shortDate } from "../../utils/format.ts";
import { groupRateText } from "../../utils/grouping.ts";
import { interestFor } from "../../utils/interest.ts";

/**
 * GroupRow — one collateral group in the shared entries table: the
 * headline row (date, customer, item, amounts, status, ⋮)
 * plus, when expanded, a detail row with the group's full ledger.
 * The WHOLE headline row is the expand click target (DotsMenu stops the
 * click), and the "+N" count sits on the amount, next to the money it
 * counts.
 */
interface Props {
  group: CollateralGroup;
  expanded: boolean;
  /** Expand/collapse toggle — the whole headline row is the target. */
  onToggle: () => void;
  /** Per-group ⋮ items; absent → no Actions cell. */
  actions?: (group: CollateralGroup) => MenuItem[];
  /** Show the Released column? (Active tab: no — nothing is released.) */
  showReleased?: boolean;
  /** Released tab → the rate cell shows the INTEREST EARNED (frozen). */
  showInterestEarned?: boolean;
  /** Active / All tabs → an INTEREST column joins the rate (outstanding). */
  showInterest?: boolean;
  /** Delete one active lend (§4.9) → the ConfirmDialog is the page's. */
  onDeleteEntry?: (entry: Entry) => void;
  /** Edit one individual lend from the group's ledger. */
  onEditEntry?: (entry: Entry) => void;
  /** The last successful save — pulses this row when it names this group. */
  flash?: FlashHint | null;
}

export default function GroupRow({ group: g, expanded, onToggle, actions, showReleased = true, showInterestEarned = false, showInterest = false, onEditEntry, onDeleteEntry, flash }: Props) {
  const td = "px-3 py-2";
  // The earned interest of a released collateral: the frozen figures of
  // its lends (interest-free releases earn — and show — a dash).
  const earned = g.subs.reduce((s, x) => s + (x.interestCollected ?? 0), 0);
  // The interest OUTSTANDING across the group's lends — the backend's
  // per-lend figure (live accrual on active, frozen once released).
  const interest = g.subs.reduce((s, x) => s + interestFor(x), 0);
  return (
    <>
      {/* Headline row: FlashTr pulses it green right after a save that
          touched this collateral (the "what just changed" marker). */}
      <FlashTr
        flash={flash}
        groupId={g.groupId}
        onClick={onToggle}
        className="cursor-pointer hover:bg-tint"
      >
        <td className={`${td} whitespace-nowrap text-xs text-slate`}>
          <span className="inline-flex items-center gap-1">
            {shortDate(g.date)}
            <i className={`ph ph-caret-down text-base text-dim transition-transform duration-300 ease-brand ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </td>
        {/* Amount: the MAIN lend; "+N" tops it up for the extra lends.
            Released collaterals instead show what came back on release
            day — actual cash when the counter recorded it. */}
        <td className={td}>
          <span
            className="inline-flex items-center gap-1.5"
            title={g.status === "Released" ? "Collected when the collateral was released" : undefined}
          >
            {g.status === "Released"
              ? money(g.primary.totalCollected ?? g.subs.reduce((s, x) => s + (x.amountReturned ?? x.amount), 0))
              : money(g.primary.amount)}
            {g.status !== "Released" && g.subs.length > 1 && (
              <span className="rounded bg-tint px-1.5 py-0.5 text-xs font-medium text-primary">
                +{g.subs.length - 1}
              </span>
            )}
          </span>
        </td>
        {/* Name + address beside it, and the collateral in full — no
            column pins anything down, so text never clips. */}
        <td className={td}>
          {g.customerName}
          {g.customerAddress && (
            <span className="ml-1.5 whitespace-nowrap text-xs text-muted">
              · {g.customerAddress}
            </span>
          )}
        </td>
        <td className={`${td} text-slate whitespace-nowrap`}>{g.item}</td>
        {/* Released tab: the frozen interest the collateral earned; other
            tabs: the interest rate of the deal. A ₹0 earns a dash. */}
        <td className={`${td} text-slate`}>
          {showInterestEarned
            ? earned > 0 ? money(earned) : "—"
            : groupRateText(g)}
        </td>
        {/* Active / All tabs: the interest OUTSTANDING — the backend's live
            figure per lend (accrued on active, already-frozen on released
            rows of the All tab), zero gets a dash. */}
        {showInterest && (
          <td className={`${td} text-slate whitespace-nowrap`}>
            {interest > 0 ? money(interest) : "—"}
          </td>
        )}
        <td className={td}><StatusBadge status={g.status} /></td>
        {/* When released: the day the collateral came back (§3.1) — shown
            only with the Released column (hidden on the Active tab). */}
        {showReleased && (
          <td className={`${td} whitespace-nowrap text-xs text-slate`}>
            {g.status === "Released" ? shortDate(g.primary.releasedDate) : "—"}
          </td>
        )}
        <td className={td} onClick={(e) => e.stopPropagation()}>
          {actions && <DotsMenu items={actions(g)} />}
        </td>
      </FlashTr>

      {expanded && (
        <tr className="bg-tint/60">
          <td colSpan={6 + (showInterest ? 1 : 0) + (showReleased ? 1 : 0) + (actions ? 1 : 0)} className="px-4 py-3">
            {/* The audit trail (Admin): who added / edited / released —
                collapsed to a History icon until opened. */}
            <GroupHistory groupId={g.groupId} />
            {/* Fixed widths + its own horizontal scroller: the ledger can
                be as long as history demands without ever pushing or
                shifting the columns of the table around it. */}
            <div className="overflow-x-auto rounded-lg border border-line bg-card">
              <LedgerTable group={g} onEditEntry={onEditEntry} onDeleteEntry={onDeleteEntry} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}