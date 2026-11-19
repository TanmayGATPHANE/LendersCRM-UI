import { useEffect, useState } from "react";
import { fetchOutsourced, outsourceReturn, canEdit } from "../api/client.ts";
import type { OutsourcedRow } from "../api/types.ts";
import DotsMenu from "../components/DotsMenu.tsx";
import { toast } from "../components/Toast.tsx";
import { SkeletonCards, SkeletonRows } from "../components/Skeleton.tsx";
import { primaryBtnCls, secondaryBtnCls, ghostIconBtnCls } from "../components/ui.ts";
import { money, shortDate, today } from "../utils/format.ts";
import { useRef } from "react";

/**
 * Outsourced (§4.8) — the collaterals currently OUT of the counter,
 * sitting with an outside party. While a group is outsourced it shows
 * ONLY on this page (the dashboard, reports and customer views hide it);
 * "Mark Returned" brings it back into all of them at once.
 */
export default function Outsourced() {
  const [rows, setRows] = useState<OutsourcedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const returning = useRef<Set<number>>(new Set()); // per-row busy latch

  async function load(): Promise<void> {
    setRefreshing(true);
    try {
      setRows(await fetchOutsourced());
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchOutsourced()
      .then(setRows)
      .catch((e: unknown) => toast((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  /** The item came back to the counter — the group returns to the
      dashboard/reports/customers views the same instant. */
  async function markReturned(r: OutsourcedRow): Promise<void> {
    if (returning.current.has(r.groupId)) return; // one click, one return
    returning.current.add(r.groupId);
    try {
      await outsourceReturn(r.groupId, today());
      toast(`Returned to the counter — ${r.customer}: ${r.item}`, "ok");
      load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      returning.current.delete(r.groupId);
    }
  }

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Toolbar: heading + count left, Refresh right */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <h1 className="text-lg font-semibold text-ink">Outsourced</h1>
        <span className="text-sm text-muted">
          Collaterals handed to an outside party — hidden from the dashboard and reports while out
        </span>
        <div className="flex-1" />
        <button onClick={load} disabled={refreshing} className={secondaryBtnCls} title="Reload the list">
          <i className={`ph ph-arrows-clockwise text-lg ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

        {/* Cards on phones, the table from md up — same shape as the other pages */}
      <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        <div className="stagger space-y-2 p-3 md:hidden">
          {loading ? <SkeletonCards count={3} /> : (
          <>
          {rows.map((r) => (
            <div key={r.groupId} className="rounded-xl border border-line p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{r.customer}</span>
                  <span className="block truncate text-xs text-muted">{r.item}</span>
                </div>
                {canEdit() && (
                  <DotsMenu items={[{ label: "Mark Returned", onClick: () => void markReturned(r) }]} />
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-muted">Outsourced to</span>
                <span className="font-medium text-ink">{r.outsourcedTo}</span>
                <span className="text-muted">Out since</span>
                <span className="text-ink">{shortDate(r.date)}</span>
                <span className="text-muted">Lent</span>
                <span className="text-ink">{money(r.amountLent)}</span>
              </div>
              {r.notes && <p className="mt-2 text-xs text-slate">{r.notes}</p>}
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">Nothing is outsourced right now.</p>
          )}
          </>
          )}
        </div>

        <table className="hidden w-full table-fixed min-w-[760px] text-sm md:table">
          <thead className="sticky top-0 z-10 bg-card border-b border-line">
            <tr>
              <th className={`${th} w-[12%]`}>Out since</th>
              <th className={`${th} w-[16%]`}>Outsourced to</th>
              <th className={`${th} w-[16%]`}>Customer</th>
              <th className={`${th} w-[22%]`}>Item</th>
              <th className={`${th} w-[10%] text-right`}>Lent</th>
              <th className={`${th} w-[16%]`}>Note</th>
              {canEdit() && <th className={`${th} w-16 text-right`}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <SkeletonRows rows={6} cols={canEdit() ? 7 : 6} />
            ) : (
            <>
            {rows.map((r) => (
              <tr key={r.groupId} className="hover:bg-tint">
                <td className="px-3 py-2 whitespace-nowrap text-slate">{shortDate(r.date)}</td>
                <td className="px-3 py-2 text-ink">{r.outsourcedTo}</td>
                <td className="px-3 py-2 text-slate">{r.customer}</td>
                <td className="px-3 py-2 text-slate">{r.item}</td>
                <td className="px-3 py-2 text-right text-ink">{money(r.amountLent)}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {r.notes || <span className="text-muted/50">—</span>}
                </td>
                {canEdit() && (
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => void markReturned(r)} title="The item is back at the counter"
                      className={ghostIconBtnCls}>
                      <i className="ph ph-arrow-u-down-left text-lg" aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={canEdit() ? 7 : 6} className="px-3 py-10 text-center text-sm text-muted">
                  Nothing is outsourced right now — use a row's ⋮ → Outsource on the Dashboard.
                </td>
              </tr>
            )}
            </>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
