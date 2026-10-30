import type { CollateralGroup, Entry } from "../../api/types.ts";
import type { MenuItem } from "../DotsMenu.tsx";
import DotsMenu from "../DotsMenu.tsx";
import StatusBadge from "../StatusBadge.tsx";
import LedgerTable from "./LedgerTable.tsx";
import { money, shortDate } from "../../utils/format.ts";
import { groupRateText, groupInterest } from "../../utils/grouping.ts";

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
  /** Edit one individual lend from the group's ledger. */
  onEditEntry?: (entry: Entry) => void;
}

export default function GroupRow({ group: g, expanded, onToggle, actions, onEditEntry }: Props) {
  const td = "px-3 py-2";
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-tint">
        <td className={`${td} text-xs text-slate`}>
          <span className="inline-flex items-center gap-1">
            {shortDate(g.date)}
            <span className={`material-symbols-outlined text-[16px] text-dim transition-transform ${expanded ? "rotate-180" : ""}`}>
              expand_more
            </span>
          </span>
        </td>
        {/* Name + area on ONE line — the city never drops below the name. */}
        <td className={td}>
          {g.customerName}
          {g.customerAddress && (
            <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted">
              · {g.customerAddress}
            </span>
          )}
        </td>
        <td className={`${td} text-slate`}>{g.item}</td>
        {/* Amount: the MAIN lend; "+N" tops it up for the extra lends.
            Released collaterals instead show what came back on release
            day — actual cash when the counter recorded it. */}
        <td className={`${td} text-right`}>
          <span
            className="inline-flex items-center gap-1.5"
            title={g.status === "Released" ? "Collected when the collateral was released" : undefined}
          >
            {g.status === "Released"
              ? money(g.primary.totalCollected ?? g.subs.reduce((s, x) => s + (x.amountReturned ?? x.amount), 0))
              : money(g.primary.amount)}
            {g.status !== "Released" && g.subs.length > 1 && (
              <span className="rounded bg-tint px-1.5 py-0.5 text-[11px] font-medium text-primary">
                +{g.subs.length - 1}
              </span>
            )}
          </span>
        </td>
        <td className={`${td} text-right text-slate`}>{groupRateText(g)}</td>
        <td className={`${td} text-right text-slate`}>
          {g.subs.every((s) => !s.rate) && g.status === "Active" ? "—" : money(groupInterest(g))}
        </td>
        <td className={td}><StatusBadge status={g.status} /></td>
        <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
          {actions && <DotsMenu items={actions(g)} />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-tint/60">
          <td colSpan={actions ? 8 : 7} className="px-4 py-3">
            {/* Fixed widths + its own horizontal scroller: the ledger can
                be as long as history demands without ever pushing or
                shifting the columns of the table around it. */}
            <div className="overflow-x-auto rounded-lg border border-line bg-card">
              <LedgerTable group={g} onEditEntry={onEditEntry} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}