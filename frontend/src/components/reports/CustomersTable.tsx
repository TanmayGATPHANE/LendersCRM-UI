import type { CustomerReportRow } from "../../api/types.ts";
import { money } from "../../utils/format.ts";
import { LoadMore, useChunkedRows } from "../LoadMore.tsx";
import { Field } from "../Field.tsx";
import { td, tdR, th, thR, Empty } from "./shared.tsx";

/** Customers — the lifetime track record per customer. TOTALS ALWAYS
    COVER EVERY ROW IN THE WINDOW; only the display rows page. */
export default function CustomersTable({ rows }: { rows: CustomerReportRow[] }) {
  // Paged display — totals below stay whole-window either way.
  const [visible, more] = useChunkedRows(rows.length);
  const shown = rows.slice(0, visible);
  if (rows.length === 0) return <Empty text="No customers yet." />;
  const t = (k: "totalLent" | "returnedPrincipal" | "interestCollected" | "activeOutstanding" | "interestAccruing") =>
    rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      {/* Mobile: one card per customer */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {shown.map((r) => (
          <div key={r.customerId} className="rounded-xl border border-line p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                {r.name}
                {r.address && (
                  <span className="ml-1.5 text-xs font-normal text-muted">· {r.address}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {r.lends} lends ({r.activeLends} active)
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Total lent">{money(r.totalLent)}</Field>
              <Field label="Returned">{money(r.returnedPrincipal)}</Field>
              <Field label="Interest collected" tone="in">{money(r.interestCollected)}</Field>
              <Field label="Outstanding" tone={r.activeOutstanding > 0 ? "ink" : "muted"}>
                {money(r.activeOutstanding)}
              </Field>
              <Field label="Accruing today" tone="muted">
                {r.interestAccruing ? money(r.interestAccruing) : "—"}
              </Field>
            </div>
          </div>
        ))}
        <div className="rounded-xl bg-tint p-3 text-sm">
          <span className="font-medium uppercase tracking-wider text-muted">Total</span>{" "}
          <span className="tabular-nums text-ink">
            Lent {money(t("totalLent"))} · Returned {money(t("returnedPrincipal"))} · Interest{" "}
            {money(t("interestCollected"))} · Outstanding {money(t("activeOutstanding"))}
          </span>
        </div>
      </div>

      <table className="hidden w-full table-fixed min-w-[860px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[18%]`}>Customer</th>
          <th className={`${th} w-[12%]`}>Lends</th>
          <th className={`${thR} w-[14%]`}>Total Lent</th>
          <th className={`${thR} w-[14%]`}>Returned</th>
          <th className={`${thR} w-[14%]`}>Interest Collected</th>
          <th className={`${thR} w-[14%]`}>Outstanding</th>
          <th className={`${thR} w-[14%]`}>Accruing Today</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {shown.map((r) => (
          <tr key={r.customerId} className="hover:bg-tint even:bg-tint/40">
            <td className={td}>
              {r.name}
              {r.address && (
                <span className="ml-1.5 whitespace-nowrap text-xs text-muted">
                  · {r.address}
                </span>
              )}
            </td>
            <td className={`${td} text-slate`}>
              {r.lends}
              <span className="text-xs text-muted"> ({r.activeLends} active)</span>
            </td>
            <td className={`${tdR} text-ink`}>{money(r.totalLent)}</td>
            <td className={`${tdR} text-ink`}>{money(r.returnedPrincipal)}</td>
            <td className={`${tdR} text-green-700`}>{money(r.interestCollected)}</td>
            <td className={`${tdR} font-medium ${r.activeOutstanding > 0 ? "text-ink" : "text-muted"}`}>
              {money(r.activeOutstanding)}
            </td>
            <td className={`${tdR} text-slate`}>{r.interestAccruing ? money(r.interestAccruing) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <tr className="text-xs">
          <td className={`${td} py-1.5 font-medium uppercase tracking-wider text-muted`}>Total</td>
          <td className={td}></td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("totalLent"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("returnedPrincipal"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-green-700`}>{money(t("interestCollected"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("activeOutstanding"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-slate`}>{money(t("interestAccruing"))}</td>
        </tr>
      </tfoot>
    </table>

    {/* Paged footer — BELOW the table, so on desktop it sits at the end
        of the scrolled content (an auto-load observer above the rows
        would fire on mount and drain the whole page). */}
    <LoadMore visible={visible} total={rows.length} onMore={more} />
    </>
  );
}