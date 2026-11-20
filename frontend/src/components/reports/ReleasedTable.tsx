import type { ReleaseReportRow } from "../../api/types.ts";
import { money, shortDate } from "../../utils/format.ts";
import { LoadMore, useChunkedRows } from "../LoadMore.tsx";
import { Field } from "../Field.tsx";
import { td, tdR, th, thR, Empty } from "./shared.tsx";

/** Released — the closed collaterals' outcome, newest release first:
    days held, principal recovered, interest frozen, the counter's actual
    cash. Totals stay whole-window; the rows page 50 at a time. */
export default function ReleasedTable({ rows }: { rows: ReleaseReportRow[] }) {
  const [visible, more] = useChunkedRows(rows.length);
  const shown = rows.slice(0, visible);
  if (rows.length === 0) return <Empty text="Nothing released yet." />;
  const t = (k: "lent" | "recoveredPrincipal" | "interestCollected") =>
    rows.reduce((s, r) => s + r[k], 0);
  // Collected (cash): only rows that recorded the actual counter figure.
  const collected = rows
    .filter((r) => r.totalCollected != null)
    .reduce((s, r) => s + (r.totalCollected ?? 0), 0);
  const collectedCount = rows.filter((r) => r.totalCollected != null).length;
  return (
    <>
      {/* Mobile: one card per released collateral */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {shown.map((r) => (
          <div key={r.groupId} className="rounded-xl border border-line p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                {r.item}
                <span className="ml-1.5 text-xs font-normal text-muted">· {r.customer}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {r.daysHeld} days held
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Field label="Lent">{money(r.lent)}</Field>
              <Field label="Recovered">{money(r.recoveredPrincipal)}</Field>
              <Field label="Interest" tone="in">{money(r.interestCollected)}</Field>
            </div>
            <p className="mt-2 text-xs text-muted">
              Released {r.releasedDate ? shortDate(r.releasedDate) : "—"}
              {r.totalCollected != null ? ` · collected ${money(r.totalCollected)}` : ""}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-tint p-3 text-sm">
          <span className="font-medium uppercase tracking-wider text-muted">Total</span>{" "}
          <span className="tabular-nums text-ink">
            Lent {money(t("lent"))} · Recovered {money(t("recoveredPrincipal"))} · Interest{" "}
            {money(t("interestCollected"))} · Collected {money(collected)}
          </span>
        </div>
      </div>

      <table className="hidden w-full table-fixed min-w-[860px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[22%]`}>Collateral</th>
          <th className={`${thR} w-[13%]`}>Lent</th>
          <th className={`${th} w-[12%]`}>Released</th>
          <th className={`${thR} w-[9%]`}>Days Held</th>
          <th className={`${thR} w-[15%]`}>Recovered</th>
          <th className={`${thR} w-[14%]`}>Interest</th>
          <th className={`${thR} w-[15%]`}>Collected (cash)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {shown.map((r) => (
          <tr key={r.groupId} className="hover:bg-tint even:bg-tint/40">
            <td className={td}>
              {r.item}
              <span className="ml-1.5 whitespace-nowrap text-xs text-muted">
                · {r.customer}
              </span>
            </td>
            <td className={`${tdR} text-ink`}>{money(r.lent)}</td>
            <td className={`${td} whitespace-nowrap text-xs text-slate`}>
              {r.releasedDate ? shortDate(r.releasedDate) : "—"}
            </td>
            <td className={`${tdR} text-slate`}>{r.daysHeld}</td>
            <td className={`${tdR} text-ink`}>{money(r.recoveredPrincipal)}</td>
            <td className={`${tdR} text-green-700`}>{money(r.interestCollected)}</td>
            <td className={`${tdR} text-slate`}>
              {r.totalCollected != null ? money(r.totalCollected) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <tr className="text-xs">
          <td className={`${td} py-1.5 font-medium uppercase tracking-wider text-muted`}>Total</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("lent"))}</td>
          <td className={td}></td>
          <td className={tdR}></td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("recoveredPrincipal"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-green-700`}>{money(t("interestCollected"))}</td>
          {/* Collected (cash): the sum of the rows that recorded the
              counter's actual figure, and a note when some did not. */}
          <td className={`${tdR} py-1.5 font-medium text-ink`}>
            {money(collected)}
            {collectedCount < rows.length && (
              <span className="block text-[11px] font-normal text-muted">
                {rows.length - collectedCount} row{rows.length - collectedCount === 1 ? "" : "s"} without a figure
              </span>
            )}
          </td>
        </tr>
      </tfoot>
    </table>

    {/* Paged footer — BELOW the table (see the Customers table note). */}
    <LoadMore visible={visible} total={rows.length} onMore={more} />
    </>
  );
}