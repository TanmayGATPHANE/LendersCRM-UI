import type { SummaryRow } from "../../api/types.ts";
import { money } from "../../utils/format.ts";
import { Field } from "../Field.tsx";
import { td, tdR, th, thR, monthLabel, Empty } from "./shared.tsx";

/** Summary — one row per month inside the global calendar window: what
    went out on lends, what came back (partials + release legs), the
    manual ±, and the month's net. Totals row across the bottom. */
export default function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) return <Empty text="No cash movement recorded yet." />;
  const t = (k: keyof SummaryRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  return (
    <>
      {/* Mobile: one card per month */}
      <div className="stagger space-y-2 p-3 md:hidden">
        {rows.map((r) => (
          <div key={r.month} className="rounded-xl border border-line p-3 shadow-sm">
            <p className="text-sm font-semibold text-ink">{monthLabel(r.month)}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="Lend out">{money(r.lentOut)}</Field>
              <Field label="Principal in">{money(r.principalIn)}</Field>
              <Field label="Interest in">{money(r.interestIn)}</Field>
              <Field label="Manual in" tone="in">{r.manualIn ? `+${money(r.manualIn)}` : "—"}</Field>
              <Field label="Manual out" tone="out">{r.manualOut ? `−${money(r.manualOut)}` : "—"}</Field>
              <Field label="Net" tone={r.net < 0 ? "out" : "in"}>{money(r.net)}</Field>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-tint p-3 text-sm">
          <span className="font-medium uppercase tracking-wider text-muted">Total</span>
          <span className="tabular-nums font-medium text-ink">
            Lend {money(t("lentOut"))} · In {money(t("principalIn") + t("interestIn") + t("manualIn"))} · Net{" "}
            <span className={t("net") < 0 ? "text-red-600" : "text-green-700"}>{money(t("net"))}</span>
          </span>
        </div>
      </div>

      <table className="hidden w-full table-fixed min-w-[760px] text-sm md:table">
      <thead className="sticky top-0 z-10 bg-card border-b border-line">
        <tr>
          <th className={`${th} w-[14%]`}>Month</th>
          <th className={`${thR} w-[15%]`}>Lend Out</th>
          <th className={`${thR} w-[15%]`}>Principal In</th>
          <th className={`${thR} w-[14%]`}>Interest In</th>
          <th className={`${thR} w-[14%]`}>Manual In</th>
          <th className={`${thR} w-[14%]`}>Manual Out</th>
          <th className={`${thR} w-[14%]`}>Net</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.month} className="hover:bg-tint even:bg-tint/40">
            <td className={`${td} whitespace-nowrap text-xs text-slate`}>{monthLabel(r.month)}</td>
            <td className={`${tdR} text-ink`}>{money(r.lentOut)}</td>
            <td className={`${tdR} text-ink`}>{money(r.principalIn)}</td>
            <td className={`${tdR} text-ink`}>{money(r.interestIn)}</td>
            <td className={`${tdR} text-green-700`}>{r.manualIn ? `+${money(r.manualIn)}` : "—"}</td>
            <td className={`${tdR} text-red-600`}>{r.manualOut ? `−${money(r.manualOut)}` : "—"}</td>
            <td className={`${tdR} font-medium ${r.net < 0 ? "text-red-600" : "text-green-700"}`}>
              {money(r.net)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10 bg-card border-t border-line shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <tr className="text-xs">
          <td className={`${td} font-medium uppercase tracking-wider text-muted`}>Total</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("lentOut"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("principalIn"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-ink`}>{money(t("interestIn"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-green-700`}>{money(t("manualIn"))}</td>
          <td className={`${tdR} py-1.5 font-medium text-red-600`}>{money(t("manualOut"))}</td>
          <td className={`${tdR} py-1.5 font-medium ${t("net") < 0 ? "text-red-600" : "text-green-700"}`}>
            {money(t("net"))}
          </td>
        </tr>
      </tfoot>
    </table>
    </>
  );
}