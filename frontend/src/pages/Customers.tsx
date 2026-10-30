import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import DotsMenu from "../components/DotsMenu.tsx";
import CustomerDialog from "../components/dialogs/CustomerDialog.tsx";
import HistoryView from "../components/history/HistoryView.tsx";
import { fetchCustomers, fetchEntries, fetchPartials, canEdit } from "../api/client.ts";
import type { Customer, Entry, Payment } from "../api/types.ts";
import { inputCls, primaryBtnCls } from "../components/ui.ts";

/**
 * Customers — the directory of people who borrow. Same behaviour as the
 * Dashboard: click a customer's name (or ⋮ → History) and an **inline
 * detail row expands beneath them** — no popup — showing their track
 * record (HistoryView component): summary numbers plus their collateral
 * table with every lend and partial return, expandable like there.
 */
export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [partials, setPartials] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null); // null = closed
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]); // customer ids with open history

  // Load everything once on mount (entries/partials power the history).
  useEffect(() => {
    fetchCustomers().then(setCustomers);
    fetchEntries().then(setEntries);
    fetchPartials().then(setPartials);
  }, []);

  // Inbound focus from the header's global search: open the hit customer's
  // history and clear the box so it is actually visible (the search filter
  // would otherwise keep showing the whole list's matches).
  const location = useLocation();
  const focusApplied = useRef<number | null>(null);
  useEffect(() => {
    const fc = (location.state as { focusCustomerId?: number } | null)?.focusCustomerId;
    if (fc == null || focusApplied.current === fc) return;
    if (!customers.some((c) => c.id === fc)) return; // wait for the list to load
    focusApplied.current = fc;
    setSearch("");
    setExpanded((prev) => (prev.includes(fc) ? prev : [...prev, fc]));
  }, [location.state, customers]);

  /** Refetch after a customer is created. */
  function refresh(): void {
    fetchCustomers().then(setCustomers);
  }

  /** Toggle a customer's inline history between open and closed. */
  function toggle(id: number): void {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Case-insensitive filter over name, phone and address (matches the
  // backend's ListAsync + the global search's customer fields).
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-6 py-4">
      {/* Toolbar: search on the left, Add Customer on the right */}
      <div className="flex shrink-0 items-center gap-3 pb-3">
        <div className="max-w-xs flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className={inputCls}
          />
        </div>
        <div className="flex-1" />
        {canEdit() && (
          <button onClick={() => setAdding(true)} className={primaryBtnCls}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Customer
          </button>
        )}
      </div>

      {/* Customer table — scrollable like the entries table; the history
          opens as an inline detail row, the table body is the scroller */}
      <div className="table-scroll flex-1 overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        <table className="table-fixed w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 z-10 bg-card border-b border-line">
            <tr>
              <th className={`${th} w-[45%]`}>Name</th>
              <th className={`${th} w-[30%]`}>Phone</th>
              <th className={`${th} w-[15%] text-right`}>Active Entries</th>
              <th className={`${th} w-[10%] text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((c) => (
              // Fragment so the customer row and (optionally) their detail
              // row render as siblings under one key.
              <Fragment key={c.id}>
                <tr className="hover:bg-tint">
                  <td className="px-3 py-2">
                    {/* Name doubles as the control that expands the inline history */}
                    <button
                      onClick={() => toggle(c.id)}
                      className="inline-flex items-center gap-1 hover:text-primary"
                      title="Show track record"
                    >
                      {/* Name — the area rides beside it, never below it. */}
                      <span className="truncate">
                        {c.name}
                        {c.address && (
                          <span className="text-[11px] text-muted"> · {c.address}</span>
                        )}
                      </span>
                      <span
                        className={`material-symbols-outlined shrink-0 text-[16px] text-dim transition-transform ${
                          expanded.includes(c.id) ? "rotate-180" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate">{c.phone ? `+91 ${c.phone}` : "—"}</td>
                  <td className="px-3 py-2 text-right text-slate">{c.activeCount}</td>
                  <td className="px-3 py-2 text-right">
                    <DotsMenu
                      items={[
                        { label: "History", onClick: () => toggle(c.id) },
                        ...(canEdit() ? [{ label: "Edit", onClick: () => setEditing(c) }] : []),
                      ]}
                    />
                  </td>
                </tr>

                {/* Inline history — same view the Dashboard rows expand to */}
                {expanded.includes(c.id) && (
                  <tr className="bg-tint/60">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="rounded-lg border border-line bg-card p-3">
                        <HistoryView customer={c} entries={entries} partials={partials} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted">
                  {customers.length === 0 ? "Add your first customer." : "No customers found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / edit customer dialog (own component, two modes) */}
      <CustomerDialog
        open={adding || Boolean(editing)}
        customer={editing ?? undefined} // undefined = add mode
        onClose={() => { setAdding(false); setEditing(null); }}
        onSaved={refresh}
      />
    </main>
  );
}