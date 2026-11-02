import type { CollateralGroup, Entry } from "../../api/types.ts";
import { money, shortDate } from "../../utils/format.ts";
import { buildLedger } from "../../utils/ledger.ts";

/**
 * LedgerTable — the passbook for one collateral (the row you expand on
 * the Dashboard, and each customer's history view). Exactly the shape
 * the counter works with (§4.6):
 *
 *   Date · Amount · Calculated interest · Interest till
 *
 * One row per money movement: a lend is a positive amount, money the
 * customer brought back is a NEGATIVE amount in the same column (its own
 * row — never merged into a lend's row). "Calculated interest" is what
 * accrued on the running balance from this row's date until "Interest
 * till" (the next movement's date, or "present"). The closing row shows
 * the RUNNING amount and the RUNNING interest. Active lends can be
 * edited individually via onEditEntry — that is how a sub-lend is edited.
 */
interface Props {
  group: CollateralGroup;
  /** Edit the lend behind a ledger row (the ⋮-less pencil); absent → no
      edit column, exactly the read-only History view. */
  onEditEntry?: (entry: Entry) => void;
}

export default function LedgerTable({ group, onEditEntry }: Props) {
  // text-left matters: <th> defaults to centered, <td> to left — without
  // it the headers float mid-column instead of sitting over the data.
  // table-fixed + per-column widths keep the columns proportionate.
  const c = "px-3 py-1.5 text-left text-xs text-muted";
  const { rows, balance, interest } = buildLedger(group);
  const last = rows.length - 1;

  return (
    // min-width lets it scroll inside its wrapper on narrow screens.
    <table className="w-full table-fixed min-w-[620px] text-sm">
      <thead>
        <tr>
          <th className={`${c} w-[12%]`}>Date</th>
          <th className={`${c} w-[14%]`}>Amount</th>
          <th className={`${c} w-[16%]`}>Calculated interest</th>
          <th className={`${c} w-[18%]`}>Interest till</th>
          <th className={c}>Notes</th>
          {onEditEntry && <th className={`${c} w-[4%]`}></th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r, i) => (
          <tr key={r.key} className="text-xs">
            <td className="px-3 py-1.5">{shortDate(r.date)}</td>
            <td className={`px-3 py-1.5 ${r.isReceived ? "text-red-600" : "text-ink"}`}>
              {r.isReceived ? `−${money(r.amount)}` : money(r.amount)}
            </td>
            {/* Interest accrued over this row's interval */}
            <td className="px-3 py-1.5">{r.interest ? money(r.interest) : "—"}</td>
            <td className="px-3 py-1.5 text-muted">{r.untilText}</td>
            <td className="px-3 py-1.5 text-slate">{r.notes || "—"}</td>
            {onEditEntry && (
              <td className="px-3 py-1 text-right">
                {r.kind === "lend" && r.status === "Active" && onEditEntry && (
                  <button
                    onClick={() => {
                      // Ledger rows are movements, not entries — the real
                      // Entry (customerId/customerName/item/…) lives on the
                      // group's sub whose id matches. Hand THAT to the edit
                      // dialog, never the row itself.
                      const entry = group.subs.find((s) => s.id === r.id);
                      if (entry) onEditEntry(entry);
                    }}
                    title="Edit this lend"
                    className={`rounded p-1 text-muted hover:bg-tint-hover hover:text-primary
                                focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-primary/40 transition-colors duration-300 ease-brand`}
                  >
                    <i className="ph ph-pencil-simple text-base" aria-hidden="true" />
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        // Closing row — the running figures for this collateral:
        // what is still out, and how much interest has accrued on it.
        <tfoot>
          <tr className="text-xs border-t border-line font-medium text-ink">
            <td className="px-3 py-1.5 uppercase tracking-wider text-muted">
              Running
            </td>
            <td className="px-3 py-1.5">{money(balance)}</td>
            <td className="px-3 py-1.5">{interest ? money(interest) : "—"}</td>
            <td colSpan={onEditEntry ? 3 : 2} className="px-3 py-1.5 text-muted">
              {rows[last]?.untilText === "present" ? "accruing" : "closed"}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}