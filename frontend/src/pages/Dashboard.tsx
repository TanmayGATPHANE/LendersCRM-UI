import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AddEntryDialog from "../components/dialogs/AddEntryDialog.tsx";
import ReleaseEntryDialog from "../components/dialogs/ReleaseEntryDialog.tsx";
import PartialReturnDialog from "../components/dialogs/PartialReturnDialog.tsx";
import EntryGroupTable from "../components/table/EntryGroupTable.tsx";
import GridTable from "../components/table/GridTable.tsx";
import type { FlashHint } from "../components/table/FlashTr.tsx";
import InsightsBar from "../components/InsightsBar.tsx";
import { primaryBtnCls, secondaryBtnCls, inputCls, selectCls } from "../components/ui.ts";
import { fetchCustomers, fetchEntries, fetchPartials, fetchInsights, updateEntry, updatePartial, updateGroupCustomer, canEdit } from "../api/client.ts";
import type { CollateralGroup, Customer, Entry, EntryStatus, Insights, Payment, SavedWhere } from "../api/types.ts";
import { buildGroups } from "../utils/grouping.ts";
import { toast } from "../components/Toast.tsx";
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

  // Inbound focus from the header's global search: a lend or partial-return
  // hit carries its group — switch to the All tab in group view, then
  // narrow the search box to that group's customer so its rows surface.
  // Applied once per navigation (guards against every refresh re-applying
  // it over the user's later edits).
  const location = useLocation();
  const focusApplied = useRef<number | null>(null);
  useEffect(() => {
    const fg = (location.state as { focusGroupId?: number } | null)?.focusGroupId;
    if (fg == null || focusApplied.current === fg) return;
    const owner = entries.find((e) => e.groupId === fg);
    if (!owner) return; // entries not loaded yet — re-runs when they arrive
    focusApplied.current = fg;
    setFilter("All");
    setView("Groups");
    setSearch(owner.customerName);
  }, [location.state, entries]);

  // True while the table is being refetched — spins the Refresh button.
  const [refreshing, setRefreshing] = useState(false);

  // Headline numbers above the table (Total Amanat / Interest / Cash) —
  // backend-computed for the SELECTED tab.
  const [insights, setInsights] = useState<Insights>({ totalAmanat: 0, interestEarned: 0, cashAvailable: 0 });

  // The save flash: which collateral the last save touched, plus a seq so
  // the green pulse re-fires even when the same group is saved twice.
  const [flash, setFlash] = useState<FlashHint | null>(null);
  const flashSeq = useRef(0);

  /** After a successful save (any entry/sub-lend/edit/partial/release):
      refresh, then mark the changed row — the pulse stays armed until the
      refreshed data is back, then fades within ~2.5s. */
  function onSaved(where?: SavedWhere): void {
    void refresh();
    if (where?.groupId == null) return;
    const seq = ++flashSeq.current;
    setFlash({ groupId: where.groupId, seq });
    window.setTimeout(() => setFlash((cur) => (cur?.seq === seq ? null : cur)), 2600);
  }

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
      toast(kind === "payment" ? "Partial return updated" : "Lend updated", "ok");
      refresh();
    } catch (err) {
      toast((err as Error).message); // e.g. editing a released lend
    }
  }

  /** The grid's Customer cell: move one whole collateral group to a
      different customer (its lends and payments move together). */
  async function moveGroup(groupId: number, customerId: number): Promise<void> {
    try {
      await updateGroupCustomer(groupId, customerId);
      toast("Customer moved", "ok");
      refresh();
    } catch (err) {
      toast((err as Error).message);
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
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Headline numbers — refreshed with every change to the books */}
      <InsightsBar insights={insights} tab={filter} />

      {/* Toolbar: filter + view + search on the left, actions on the right.
          Wraps instead of squeezing when the window is narrow. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        {/* Toolbar: focus rings on every control (keyboard parity) */}
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-300 ease-brand
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
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
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors duration-300 ease-brand
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                view === v ? "bg-primary text-on-primary" : "text-slate hover:bg-tint-hover"
              }`}
            >
              <i className={`ph ${v === "Groups" ? "ph-rows" : "ph-table"} text-base`} aria-hidden="true" />
              {v}
            </button>
          ))}
        </div>

        <div className="min-w-44 max-w-xs flex-1">
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
          className={selectCls}
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
          className={selectCls}
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
          <i
            className={`ph ph-arrows-clockwise text-lg ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </button>

        {/* Writing is Admin/Lender only — view-only accounts browse. */}
        {canEdit() && (
          <button onClick={() => setShowAdd(true)} className={primaryBtnCls}>
            <i className="ph ph-plus text-lg" aria-hidden="true" />
            Add Entry
          </button>
        )}
      </div>

      {/* Entries region — the only scrolling region on this page. Both
          views show the already-filtered `shown` groups; only the shape
          changes (grouped rows vs flat grid). */}
      {view === "Groups" ? (
        <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <EntryGroupTable
            groups={shown}
            actions={canEdit() ? actionsFor : undefined}
            onEditEntry={setEditing} // edit one lend (row ⋮ Edit, or a sub-lend here)
            flash={flash}
          />
        </div>
      ) : (
        // Flat grid — same data, one row per lend, sorted by customer,
        // every data column editable in the cell.
        <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <GridTable
            groups={shown}
            customers={customers}
            readOnly={!canEdit()}
            flash={flash}
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
        onSaved={onSaved}
      />
      <ReleaseEntryDialog
        open={Boolean(releasing)}
        group={releasing}
        onClose={() => setReleasing(null)}
        onSaved={onSaved}
      />
      <PartialReturnDialog
        open={Boolean(partlyReturning)}
        group={partlyReturning}
        onClose={() => setPartlyReturning(null)}
        onSaved={onSaved}
      />
    </main>
  );
}