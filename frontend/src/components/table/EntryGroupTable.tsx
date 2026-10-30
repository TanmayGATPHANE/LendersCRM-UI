import { useState } from "react";
import type { CollateralGroup, Entry } from "../../api/types.ts";
import type { MenuItem } from "../DotsMenu.tsx";
import GroupRow from "./GroupRow.tsx";

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
}

export default function EntryGroupTable({ groups, actions, onEditEntry }: Props) {
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
          <th className={`${th} w-[17%]`}>Customer Name</th>
          <th className={`${th} w-[20%]`}>Collateral Item</th>
          <th className={`${thR} w-[13%]`}>Amount</th>
          <th className={`${thR} w-[8%]`}>Rate</th>
          <th className={`${thR} w-[12%]`}>Interest</th>
          <th className={`${th} w-[10%]`}>Status</th>
          {actions && <th className={`${thR} w-[10%]`}>Actions</th>}
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
          />
        ))}
        {groups.length === 0 && (
          <tr>
            <td colSpan={actions ? 8 : 7} className="px-3 py-10 text-center text-sm text-muted">
              No entries found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}