import { useState } from "react";
import type { CollateralGroup, Entry } from "../../api/types.ts";
import type { MenuItem } from "../DotsMenu.tsx";
import GroupRow from "./GroupRow.tsx";
import type { FlashHint } from "./FlashTr.tsx";

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
    <table className="w-full table-fixed min-w-[820px] text-sm">
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
      <tbody className="divide-y divide-line">
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
                <span className="material-symbols-outlined text-[28px] text-dim">inventory_2</span>
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
  );
}