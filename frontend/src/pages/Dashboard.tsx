import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AddEntryDialog from "../components/dialogs/AddEntryDialog.tsx";
import ReleaseEntryDialog from "../components/dialogs/ReleaseEntryDialog.tsx";
import PartialReturnDialog from "../components/dialogs/PartialReturnDialog.tsx";
import ImportDialog from "../components/dialogs/ImportDialog.tsx";
import OutsourceDialog from "../components/dialogs/OutsourceDialog.tsx";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { money, shortDate } from "../utils/format.ts";
import EntryGroupTable, { type SortCol, type SortSpec } from "../components/table/EntryGroupTable.tsx";
import GridTable from "../components/table/GridTable.tsx";
import { LoadMore, useChunkedRows } from "../components/LoadMore.tsx";
import type { FlashHint } from "../components/table/FlashTr.tsx";
import InsightsBar from "../components/InsightsBar.tsx";
import { primaryBtnCls, secondaryBtnCls, inputCls, selectCls } from "../components/ui.ts";
import { fetchCustomers, fetchEntries, fetchPartials, fetchInsights, updateEntry, updatePartial, updateGroupCustomer, deleteEntry, deleteGroup, canEdit } from "../api/client.ts";
import type { CollateralGroup, Customer, Entry, EntryStatus, Insights, Payment, SavedWhere } from "../api/types.ts";
import { buildGroups } from "../utils/grouping.ts";
import { toast } from "../components/Toast.tsx";
import { matchesGroup } from "../utils/search.ts";
import MonthYearFilter from "../components/MonthYearFilter.tsx";
import { windowFrom } from "../utils/format.ts";

/** The three status filters shown as a segmented control. */
const FILTERS: Array<"All" | EntryStatus> = ["All", "Active", "Released"];

/** Any value the status filter can hold ("All" is not an EntryStatus). */
type EntryFilter = (typeof FILTERS)[number];

/** The two view shapes: grouped ledger rows, or a flat spreadsheet grid. */
const VIEWS: Array<"Groups" | "Grid"> = ["Groups", "Grid"];

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
  // First-load skeleton: the tables stand as grey rows until the books
  // arrive; later refreshes keep the previous rows on screen (no flicker).
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EntryFilter>("Active"); // daily work = active lends
  const [view, setView] = useState<"Groups" | "Grid">("Groups"); // Groups = ledger rows; Grid = spreadsheet
  // Month + year of the first lend — defaults, never persisted: the
  // counter's work set opens on the current year, all months visible.
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  // Which dialogs are open: group being released, entry being edited,
  // group receiving a sub-lend or a partial return, or a plain Add Entry.
  const [releasing, setReleasing] = useState<CollateralGroup | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [subGroup, setSubGroup] = useState<CollateralGroup | null>(null);
  const [partlyReturning, setPartlyReturning] = useState<CollateralGroup | null>(null);
  const [outsourcing, setOutsourcing] = useState<CollateralGroup | null>(null); // §4.8
  // §4.9 deletions: the whole collateral, or one lend from its ledger.
  const [deletingGroup, setDeletingGroup] = useState<CollateralGroup | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false); // Excel lending-book import (§4.7)

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
    // The month/year filters default to today — a focused collateral from
    // an older month must not be filtered out of view while it is found.
    setMonth("all");
    setYear("all");
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
      suggestions right away, not after a reload). The tiles read the
      SAME month/year window the table shows. */
  async function refresh(): Promise<void> {
    const w = windowFrom(month, year);
    const [e, p, i, c] = await Promise.all([
      fetchEntries(), fetchPartials(), fetchInsights(filterRef.current, w.from, w.to), fetchCustomers(),
    ]);
    setEntries(e);
    setPartials(p);
    setInsights(i);
    setCustomers(c);
    setLoading(false);
  }

  /** Switching tabs or moving the month/year window refetches the tiles
      for that view — the numbers are the API's, never computed here. The
      first render skips this: the mount's refresh() above already fetched
      the current tab + window, so firing again would double the request. */
  const tabsFetched = useRef(false);
  useEffect(() => {
    if (!tabsFetched.current) { tabsFetched.current = true; return; }
    let live = true;
    const w = windowFrom(month, year);
    fetchInsights(filter, w.from, w.to)
      .then((i) => { if (live) setInsights(i); })
      .catch(() => { /* the initial refresh surfaces real errors */ });
    return () => { live = false; };
  }, [filter, month, year]);

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

  // The years any record falls in — feeds the year dropdown; the current
  // year always sits in the list (the default filter), even on a fresh book.
  const years = useMemo(() => {
    const ys = new Set<string>([String(new Date().getFullYear())]);
    if (year !== "all") ys.add(year);
    for (const e of entries) if (e.date) ys.add(e.date.slice(0, 4));
    for (const p of partials) if (p.date) ys.add(p.date.slice(0, 4));
    return [...ys].sort().reverse();
  }, [entries, partials, year]);

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

  // Column sorting — the header click sets the column (re-clicking the
  // same one flips asc/desc); a fresh column always starts ascending.
  const [sort, setSort] = useState<SortSpec>({ col: "date", dir: "asc" });
  function onSort(col: SortCol): void {
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  }

  // Sort BEFORE pagination, so the visible pages follow the header. The
  // amount column sorts by what its row shows (the collected figure on a
  // released collateral, the main lend otherwise).
  const sorted = useMemo(
    () =>
      sort.col === "date" && sort.dir === "asc"
        ? shown // the data's natural order — sort nothing
        : [...shown].sort((a, b) => {
            const flip = sort.dir === "desc" ? -1 : 1;
            switch (sort.col) {
              case "customer":
                return flip * a.customerName.localeCompare(b.customerName);
              case "amount": {
                const av = a.status === "Released" ? (a.primary.totalCollected ?? 0) : a.primary.amount;
                const bv = b.status === "Released" ? (b.primary.totalCollected ?? 0) : b.primary.amount;
                return flip * (av - bv);
              }
              case "rate": {
                const ar = a.primary.rate ?? -1;
                const br = b.primary.rate ?? -1;
                if (ar !== br) return flip * (ar - br);
                return flip * a.customerName.localeCompare(b.customerName);
              }
              // The Released tab's Interest Earned column — the frozen figures.
              case "earned": {
                const ae = a.subs.reduce((s, x) => s + (x.interestCollected ?? 0), 0);
                const be = b.subs.reduce((s, x) => s + (x.interestCollected ?? 0), 0);
                if (ae !== be) return flip * (ae - be);
                return flip * a.customerName.localeCompare(b.customerName);
              }
              // The Interest column (Active/All) — the per-lend figure the
              // row shows: live accrual on active, frozen on released rows.
              case "interest": {
                const ai = a.subs.reduce((s, x) => s + (x.interest ?? 0), 0);
                const bi = b.subs.reduce((s, x) => s + (x.interest ?? 0), 0);
                if (ai !== bi) return flip * (ai - bi);
                return flip * a.customerName.localeCompare(b.customerName);
              }
              case "status": {
                const rank = (x: string) => (x === "Active" ? 0 : 1);
                if (rank(a.status) !== rank(b.status)) return flip * (rank(a.status) - rank(b.status));
                return flip * a.date.localeCompare(b.date);
              }
              default:
                return flip * a.date.localeCompare(b.date);
            }
          }),
    [shown, sort]
  );

  // Paged rendering — 50 groups at a time (scroll or "Show more"), so a
  // 1,000-customer book lays out only the slice in view. The Add Entry
  // suggestions below still see the FULL filtered list.
  const [visibleGroups, moreGroups] = useChunkedRows(sorted.length);
  const paged = sorted.slice(0, visibleGroups);

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
      { label: "Outsource", onClick: () => setOutsourcing(g), hidden: g.status !== "Active" },
      // §4.9 — the wrong collateral archives + vanishes; the dialog warns.
      { label: "Delete", onClick: () => setDeletingGroup(g), hidden: g.status !== "Active" },
    ];
  }

  async function removeEntryNow(entry: Entry | null): Promise<void> {
    if (!entry) return;
    try {
      await deleteEntry(entry.id);
      toast("Entry deleted and archived", "ok");
      refresh();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function removeGroupNow(group: CollateralGroup | null): Promise<void> {
    if (!group) return;
    try {
      await deleteGroup(group.groupId);
      toast("Collateral deleted and archived", "ok");
      refresh();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Headline numbers — refreshed with every change to the books */}
      <InsightsBar insights={insights} tab={filter} loading={loading} />

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

        {/* The search stretches all the way to the month/year filters and
            shrinks with the window (min keeps it typable on small rows). */}
        <div className="min-w-40 flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, item or date…"
            className={inputCls}
          />
        </div>

        {/* Month + year of the first lend, with the filtered count beside */}
        <MonthYearFilter
          month={month}
          year={year}
          years={years}
          onMonth={setMonth}
          onYear={setYear}
        />
        {/* How many collaterals the month/year window (plus the tab and
            search filters) holds — the books at a glance. */}
        <span
          className="rounded-full bg-tint px-3 py-1.5 text-sm font-medium text-ink"
          title="Collaterals matching these filters"
        >
          {shown.length} {shown.length === 1 ? "entry" : "entries"}
        </span>

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
          <>
            <button onClick={() => setShowImport(true)} className={secondaryBtnCls} title="Import a yearly Excel lending book">
              <i className="ph ph-microsoft-excel-logo text-lg" aria-hidden="true" />
              Import
            </button>
            <button onClick={() => setShowAdd(true)} className={primaryBtnCls}>
              <i className="ph ph-plus text-lg" aria-hidden="true" />
              Add Entry
            </button>
          </>
        )}
      </div>

      {/* Entries region — the only scrolling region on this page. Both
          views show the already-filtered `shown` groups; only the shape
          changes (grouped rows vs flat grid). */}
      {view === "Groups" ? (
        <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <EntryGroupTable
            groups={paged}
            actions={canEdit() ? actionsFor : undefined}
            loading={loading}
            showReleased={filter !== "Active"}
            statusTab={filter}
            sort={sort}
            onSort={onSort}
            onEditEntry={setEditing} // edit one lend (row ⋮ Edit, or a sub-lend here)
            onDeleteEntry={setDeletingEntry} // §4.9 — delete one lend from its ledger row
            flash={flash}
          />
          <LoadMore visible={visibleGroups} total={shown.length} onMore={moreGroups} />
        </div>
      ) : (
        // Flat grid — same data, one row per lend, sorted by customer,
        // every data column editable in the cell.
        <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <GridTable
            groups={paged}
            customers={customers}
            loading={loading}
            readOnly={!canEdit()}
            statusTab={filter}
            flash={flash}
            onUpdate={(id, patch) => patchRow("lend", id, patch)}
            onPaymentUpdate={(id, patch) => patchRow("payment", id, patch)}
            onCustomerMove={moveGroup}
          />
          <LoadMore visible={visibleGroups} total={shown.length} onMore={moreGroups} />
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
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSaved={() => refresh()}
      />
      <OutsourceDialog
        open={Boolean(outsourcing)}
        group={outsourcing}
        onClose={() => setOutsourcing(null)}
        onSaved={onSaved}
      />

      {/* §4.9 — the delete confirmations (archive + remove, Writer-only) */}
      <ConfirmDialog
        open={Boolean(deletingGroup)}
        title="Delete Collateral"
        message={
          deletingGroup
            ? `Delete ${deletingGroup.customerName}'s collateral (${deletingGroup.item}, ${money(deletingGroup.totalAmount)} lent)? Every lend of it — ${deletingGroup.subs.length} in the books — and its cash entries are removed, and the records move to the deleted archive (EntriesDeleted).`
            : ""
        }
        confirmLabel="Delete Collateral"
        onClose={() => setDeletingGroup(null)}
        onConfirm={() => removeGroupNow(deletingGroup)}
      />
      <ConfirmDialog
        open={Boolean(deletingEntry)}
        title="Delete Lend"
        message={
          deletingEntry
            ? `Delete this lend of ${money(deletingEntry.amount)}, ${shortDate(deletingEntry.date)} — ${deletingEntry.item}? It is removed from the books (its cash entry goes with it) and archived to EntriesDeleted.`
            : ""
        }
        confirmLabel="Delete Lend"
        onClose={() => setDeletingEntry(null)}
        onConfirm={() => removeEntryNow(deletingEntry)}
      />
    </main>
  );
}