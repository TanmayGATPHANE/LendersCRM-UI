import type { Customer, Entry, Payment } from "../../api/types.ts";
import EntryGroupTable from "../table/EntryGroupTable.tsx";
import { money } from "../../utils/format.ts";
import { buildGroups, interestCollected } from "../../utils/grouping.ts";

/**
 * HistoryView — one customer's track record: a summary of their numbers
 * (lent, returned, outstanding, interest collected) followed by the same
 * collateral-group table the Dashboard uses — read-only (no actions
 * column), expandable exactly like there. Built from the shared
 * buildGroups() so the two screens can never disagree.
 */
interface Props {
  customer: Customer;
  /** All entries/partials on the books — filtered to this customer here. */
  entries: Entry[];
  partials: Payment[];
}

export default function HistoryView({ customer, entries, partials }: Props) {
  // The customer's collateral groups and their totals.
  const groups = buildGroups(entries, partials).filter(
    (g) => g.customerId === customer.id
  );
  const activeGroups = groups.filter((g) => g.status === "Active");
  const record = {
    collateralsActive: activeGroups.length,
    totalLent: groups.reduce((s, g) => s + g.totalAmount, 0),
    returnedSoFar: groups.reduce((s, g) => s + g.totalPaid, 0),
    outstanding: activeGroups.reduce((s, g) => s + g.outstanding, 0),
    interestCollected: interestCollected(groups),
  };

  // [label, value] pairs — the first is a count, the rest money strings.
  const stats: [string, string | number][] = [
    ["Collaterals active", record.collateralsActive],
    ["Total lent", money(record.totalLent)],
    ["Returned so far", money(record.returnedSoFar)],
    ["Outstanding principal", money(record.outstanding)],
    ["Interest collected", money(record.interestCollected)],
  ];

  return (
    <div className="space-y-4">
      {/* Track-record summary */}
      <div className="rounded-lg bg-tint p-3">
        <div className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col pr-2">
              <span className="text-xs text-muted">{label}</span>
              <span className="text-ink">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Their collateral groups, expandable like the Dashboard */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <EntryGroupTable groups={groups} />
      </div>
    </div>
  );
}