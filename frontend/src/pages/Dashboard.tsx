import { useEffect, useMemo, useRef, useState } from "react";
import AddEntryDialog from "../components/dialogs/AddEntryDialog.tsx";
import ReleaseEntryDialog from "../components/dialogs/ReleaseEntryDialog.tsx";
import PartialReturnDialog from "../components/dialogs/PartialReturnDialog.tsx";
import EntryGroupTable from "../components/table/EntryGroupTable.tsx";
import GridTable from "../components/table/GridTable.tsx";
import InsightsBar from "../components/InsightsBar.tsx";
import { primaryBtnCls, secondaryBtnCls, inputCls } from "../components/ui.ts";
import { fetchCustomers, fetchEntries, fetchPartials, fetchInsights, updateEntry, updatePartial, updateGroupCustomer, canEdit } from "../api/client.ts";
import type { CollateralGroup, Customer, Entry, EntryStatus, Insights, Payment } from "../api/types.ts";
import { buildGroups } from "../utils/grouping.ts";
import { matchesGroup } from "../utils/search.ts";

/** The three status filters shown as a segmented control. */
const FILTERS: Array<"All" | EntryStatus> = ["All", "Active", "Released"];

/** Any value the status filter can hold ("All" is not an EntryStatus). */
type EntryFilter = (typeof FILTERS)[number];

/** The two view shapes: grouped ledger rows, or a flat spreadsheet grid. */
const VIEWS: Array<"Groups" | "Grid"> = ["Groups", "Grid"];

/** Month filter options — value is the 2-digit month of the ISO date. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Dashboard — day-to-day lending screen: search + status filter + Add
 * Entry above a scrollable entries table. Each row is one *collateral
 * group* (one customer, one collateral); top-up lends collapse under the
 * first lend as "+N", and clicking a name shows that group's history.
 * The page itself never scrolls; only the table body does.
 */
export default function Dashboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partials, setPartials] = useState<Payment[]>([]); // partial returns (§4.6)
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EntryFilter>("Active"); // daily work = active lends
  const [view, setView] = useState<"Groups" | "Grid">("Groups"); // Groups = ledger rows; Grid = spreadsheet
  const [month, setMonth] = useState("all"); // month of the first lend
  const [year, setYear] = useState("all"); // year of the first lend

  // Which dialogs are open: group being released, entry being edited,
  // group receiving a sub-lend or a partial return, or a plain Add Entry.
  const [releasing, setReleasing] = useState<CollateralGroup | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [subGroup, setSubGroup] = useState<CollateralGroup | null>(null);
  const [partlyReturning, setPartlyReturning] = useState<CollateralGroup | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Load everything once on mount — customers ride along so the Add
  // Entry suggestions always know about customers created since.
  useEffect(() => {
    refresh();
  }, []);

  // True while the table is being refetched — spins the Refresh button.
  const [refreshing, setRefreshing] = useState(false);

  // Headline numbers above the table (Total Amanat / Interest / Cash) —
  // backend-computed for the SELECTED tab.
  const [insights, setInsights] = useState<Insights>({ totalAmanat: 0, interestEarned: 0, cashAvailable: 0 });

  // refresh() runs on saves/dialog closes; it must use the filter that is
  // live at that moment, hence the ref.
  const filterRef = useRef<EntryFilter>(filter);
  filterRef.current = filter;

  /** Refetch entries + payments + insights + the customer list from the
      API (used by dialogs and the Refresh button below — insights update
      on every change, and new customers must appear in the Add Entry
      suggestions right away, not after a reload). */
  async function refresh(): Promise<void> {
    const [e, p, i, c] = await Promise.all([
      fetchEntries(), fetchPartials(), fetchInsights(filterRef.current), fetchCustomers(),
    ]);
    setEntries(e);
    setPartials(p);
    setInsights(i);
    setCustomers(c);
  }

  /** Switching tabs refetches the tiles for that tab — the numbers are
      the API's, never computed here. */
  useEffect(() => {
    let live = true;
    fetchInsights(filter)
      .then((i) => { if (live) setInsights(i); })
      .catch(() => { /* the initial refresh surfaces real errors */ });
    return () => { live = false; };
  }, [filter]);

  /** The toolbar's Refresh button: reload the table in front of you. */
  async function refreshNow(): Promise<void> {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // Grid-cell patches ride in with input-string values (the grid hands
  // EditCell's raw draft to these); the API layer coerces them to numbers.
  type LendPatch = {
    date?: string;
    item?: string;
    amount?: string | number;
    rate?: string | number | null;
    notes?: string;
  };
  type PaymentPatch = {
    date?: string;
    amount?: string | number;
    notes?: string;
  };

  /** Commit one edited grid cell on a lend or payment row. */
  async function patchRow(
    kind: "lend" | "payment",
    id: number,
    patch: LendPatch | PaymentPatch
  ): Promise<void> {
    try {
      await (kind === "payment"
        ? updatePartial(id, patch) // both patch shapes fit a payment
        // The strings-over-the-wire patch: numbers arrive uncoerced here.
        : updateEntry(id, patch as unknown as Parameters<typeof updateEntry>[1]));
      refresh();
    } catch (err) {
      alert((err as Error).message); // e.g. editing a released lend
    }
  }

  /** The grid's Customer cell: move one whole collateral group to a
      different customer (its lends and payments move together). */
  async function moveGroup(groupId: number, customerId: number): Promise<void> {
    try {
      await updateGroupCustomer(groupId, customerId);
      refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  // The years any record falls in — feeds the year dropdown (nearest
  // refresh button); defaults to "all".
  const years = useMemo(() => {
    const ys = new Set<string>();
    for (const e of entries) if (e.date) ys.add(e.date.slice(0, 4));
    for (const p of partials) if (p.date) ys.add(p.date.slice(0, 4));
    return [...ys].sort().reverse();
  }, [entries, partials]);

  // Collateral groups + global search (customer / item / date / amount)
  // + status filter + month/year of the collateral's first lend. Both
  // views render these same groups.
  const shown = useMemo(
    () => buildGroups(entries, partials).filter((g) => {
      if (filter !== "All" && g.status !== filter) return false;
      if (!matchesGroup(g, search)) return false;
      const d = g.date || ""; // mm/dd land on the year the lend was made
      if (year !== "all" && d.slice(0, 4) !== year) return false;
      if (month !== "all" && d.slice(5, 7) !== month) return false;
      return true;
    }),
    [entries, partials, search, filter, month, year]
  );

  /** One ⋮-menu action on a collateral-group row (shape the shared
      DotsMenu/EntryGroupTable expect). */
  interface RowAction {
    label: string;
    onClick: () => void;
    hidden: boolean;
  }

  /** Row actions for the shared table (⋮ menu), per collateral group. */
  function actionsFor(g: CollateralGroup): RowAction[] {
    return [
      { label: "Edit", onClick: () => setEditing(g.primary), hidden: g.status !== "Active" },
      { label: "Add Sub-Lend", onClick: () => setSubGroup(g), hidden: g.status !== "Active" },
      { label: "Partial Return", onClick: () => setPartlyReturning(g), hidden: g.status !== "Active" },
      { label: "Release", onClick: () => setReleasing(g), hidden: g.status !== "Active" },
    ];
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-6 py-4">
      {/* Headline numbers — refreshed with every change to the books */}
      <InsightsBar insights={insights} tab={filter} />

      {/* Toolbar: filter + view + search on the left, actions on the right */}
      <div className="flex shrink-0 items-center gap-3 pb-3">
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === f ? "bg-primary text-on-primary" : "text-slate hover:bg-tint-hover"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* View shape: grouped ledger rows or the flat grid (like Compass) */}
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              title={v === "Groups" ? "One row per collateral" : "Flat spreadsheet grid, one row per lend"}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === v ? "bg-primary text-on-primary" : "text-slate hover:bg-tint-hover"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {v === "Groups" ? "segment" : "grid_on"}
              </span>
              {v}
            </button>
          ))}
        </div>

        <div className="max-w-xs flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, item or date…"
            className={inputCls}
          />
        </div>

        <div className="flex-1" />

        {/* Month + year of the first lend, near the Refresh button */}
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          title="Filter by month of the lend"
          className="rounded-lg border border-line bg-tint px-2.5 py-2 text-sm text-slate hover:bg-tint-hover focus:outline-none"
        >
          <option value="all">All months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          title="Filter by year of the lend"
          className="rounded-lg border border-line bg-tint px-2.5 py-2 text-sm text-slate hover:bg-tint-hover focus:outline-none"
        >
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Reload the table without touching the filter or search */}
        <button
          onClick={refreshNow}
          disabled={refreshing}
          className={secondaryBtnCls}
          title="Reload the table"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${refreshing ? "animate-spin" : ""}`}
          >
            refresh
          </span>
          Refresh
        </button>

        {/* Writing is Admin/Lender only — view-only accounts browse. */}
        {canEdit() && (
          <button onClick={() => setShowAdd(true)} className={primaryBtnCls}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Entry
          </button>
        )}
      </div>

      {/* Entries region — the only scrolling region on this page. Both
          views show the already-filtered `shown` groups; only the shape
          changes (grouped rows vs flat grid). */}
      {view === "Groups" ? (
        <div className="table-scroll flex-1 overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <EntryGroupTable
            groups={shown}
            actions={canEdit() ? actionsFor : undefined}
            onEditEntry={setEditing} // edit one lend (row ⋮ Edit, or a sub-lend here)
          />
        </div>
      ) : (
        // Flat grid — same data, one row per lend, sorted by customer,
        // every data column editable in the cell.
        <div className="table-scroll flex-1 overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <GridTable
            groups={shown}
            customers={customers}
            readOnly={!canEdit()}
            onUpdate={(id, patch) => patchRow("lend", id, patch)}
            onPaymentUpdate={(id, patch) => patchRow("payment", id, patch)}
            onCustomerMove={moveGroup}
          />
        </div>
      )}

      {/* Dialogs */}
      <AddEntryDialog
        open={showAdd || Boolean(editing) || Boolean(subGroup)}
        entry={editing || undefined}
        group={subGroup || undefined}
        groups={shown.filter((g) => g.status === "Active")}
        customers={customers}
        onClose={() => { setShowAdd(false); setEditing(null); setSubGroup(null); }}
        onSaved={refresh}
      />
      <ReleaseEntryDialog
        open={Boolean(releasing)}
        group={releasing}
        onClose={() => setReleasing(null)}
        onSaved={refresh}
      />
      <PartialReturnDialog
        open={Boolean(partlyReturning)}
        group={partlyReturning}
        onClose={() => setPartlyReturning(null)}
        onSaved={refresh}
      />
    </main>
  );
}