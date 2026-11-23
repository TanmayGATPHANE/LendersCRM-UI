import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AddEntryDialog from "../components/dialogs/AddEntryDialog.tsx";
import ReleaseEntryDialog from "../components/dialogs/ReleaseEntryDialog.tsx";
import PartialReturnDialog from "../components/dialogs/PartialReturnDialog.tsx";
import OutsourceDialog from "../components/dialogs/OutsourceDialog.tsx";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { money, shortDate } from "../utils/format.ts";
import EntryGroupTable, { type SortCol, type SortSpec } from "../components/table/EntryGroupTable.tsx";
import GridTable from "../components/table/GridTable.tsx";
import { LoadMore, PAGE_SIZE } from "../components/LoadMore.tsx";
import type { FlashHint } from "../components/table/FlashTr.tsx";
import InsightsBar from "../components/InsightsBar.tsx";
import { primaryBtnCls, iconBtnCls, inputCls } from "../components/ui.ts";
import { fetchCustomers, fetchGroupsPage, fetchGroup, fetchInsights, updateEntry, updatePartial, updateGroupCustomer, deleteEntry, deleteGroup, canEdit } from "../api/client.ts";
import type { CollateralGroup, Customer, Entry, EntryStatus, Insights, SavedWhere } from "../api/types.ts";
import { toast } from "../components/Toast.tsx";
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
  // The dashboard's rows come PAGE BY PAGE from the API: filters, sort and
  // skip/take run in SQL, so a 50-year book never downloads in full. `rows`
  // is everything loaded so far; `total` is what the filters match (the
  // count badge + the "Show more" footer).
  const [rows, setRows] = useState<CollateralGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [years, setYears] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  // First-load skeleton: the tables stand as grey rows until the first page
  // arrives; later refreshes keep the previous rows on screen (no flicker).
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // The search the server sees — the box updates immediately, the query
  // fires once typing settles (never on every keystroke).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<EntryFilter>("Active"); // daily work = active lends
  const [view, setView] = useState<"Groups" | "Grid">("Groups"); // Groups = ledger rows; Grid = spreadsheet
  // Month + year of the first lend — defaults, never persisted: the
  // counter's work set opens on the current year, all months visible.
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  // Column sorting — the server sorts the whole matching set, so the
  // visible pages follow the header. A fresh column starts ascending.
  const [sort, setSort] = useState<SortSpec>({ col: "date", dir: "asc" });
  function onSort(col: SortCol): void {
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  }

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

  // The customer directory rides along once on mount — the Add Entry
  // suggestions need everyone on file (the rows themselves page in).
  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => { /* suggestions stay empty */ });
  }, []);

  // The box updates on every keystroke; the server query waits for the
  // typing to settle so a search never fires per character.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  // Live values for callbacks that run outside the page effect (a save, the
  // Show-more footer): they must read the filters as they are right now.
  const filterRef = useRef<EntryFilter>(filter);
  filterRef.current = filter;
  const rowsRef = useRef<CollateralGroup[]>([]);
  rowsRef.current = rows;
  // A sequence per list request: a slow older response must never overwrite
  // a newer one (typing + a save can race).
  const requestSeq = useRef(0);
  // One in-flight page fetch at a time — the footer's observer can fire
  // again before React has re-rendered.
  const loadingMoreRef = useRef(false);
  // True while page 1 is being fetched (a filter/search/sort change):
  // "Show more" must not append an old page under the new filter's rows.
  const firstPagePendingRef = useRef(false);
  // Same guard for a post-save refresh, which replaces the loaded window.
  const refreshPendingRef = useRef(false);

  // Page one of the dashboard — refetched whenever a filter, the search or
  // the sort changes. Filters/sort run in SQL; the browser only gets a page.
  useEffect(() => {
    let live = true;
    firstPagePendingRef.current = true;
    const seq = ++requestSeq.current;
    fetchGroupsPage({
      tab: filter, month, year, search: debouncedSearch,
      sort: sort.col, dir: sort.dir, skip: 0, take: PAGE_SIZE,
    })
      .then((page) => {
        if (!live || seq !== requestSeq.current) return;
        setRows(page.rows);
        setTotal(page.total);
        setYears(page.years);
        setLoading(false);
      })
      .catch(() => { if (live) setLoading(false); })
      .finally(() => { if (live) firstPagePendingRef.current = false; });
    return () => { live = false; };
  }, [filter, month, year, debouncedSearch, sort.col, sort.dir]);

  // Inbound focus from the header's global search: a lend or partial-return
  // hit carries its group — switch to the All tab in group view, then
  // narrow the search box to that group's customer so its rows surface.
  // The group is fetched by id (it may be on a page that is not loaded).
  // Applied once per navigation.
  const location = useLocation();
  const focusApplied = useRef<number | null>(null);
  useEffect(() => {
    const fg = (location.state as { focusGroupId?: number } | null)?.focusGroupId;
    if (fg == null || focusApplied.current === fg) return;
    focusApplied.current = fg;
    fetchGroup(fg)
      .then((g) => {
        setFilter("All");
        setView("Groups");
        // The month/year filters default to today — a focused collateral
        // from an older month must not be filtered out of view.
        setMonth("all");
        setYear("all");
        setSearch(g.customer.name);
      })
      .catch(() => { focusApplied.current = null; });
  }, [location.state]);

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

  /** Refetch the rows already on screen (every loaded page in one request),
      the tiles and the customer list — used after a save and by the
      Refresh button. The reload is capped at 200 rows; past that the user
      is deep in an infinite scroll and the next "Show more" continues. */
  async function refresh(): Promise<void> {
    const w = windowFrom(month, year);
    const take = Math.max(PAGE_SIZE, Math.min(200, rowsRef.current.length || PAGE_SIZE));
    const seq = ++requestSeq.current;
    refreshPendingRef.current = true;
    try {
      const [page, i, c] = await Promise.all([
        fetchGroupsPage({
          tab: filterRef.current, month, year, search: debouncedSearch,
          sort: sort.col, dir: sort.dir, skip: 0, take,
        }),
        fetchInsights(filterRef.current, w.from, w.to),
        fetchCustomers(),
      ]);
      if (seq !== requestSeq.current) return;
      setRows(page.rows);
      setTotal(page.total);
      setYears(page.years);
      setInsights(i);
      setCustomers(c);
      setLoading(false);
    } catch { /* a failed refresh keeps the last good rows on screen */ }
    finally { refreshPendingRef.current = false; }
  }

  /** The footer's next page — appended to what is already rendered. */
  async function loadMore(): Promise<void> {
    if (loadingMoreRef.current || firstPagePendingRef.current || refreshPendingRef.current) return;
    loadingMoreRef.current = true;
    const seq = ++requestSeq.current;
    try {
      const page = await fetchGroupsPage({
        tab: filterRef.current, month, year, search: debouncedSearch,
        sort: sort.col, dir: sort.dir, skip: rowsRef.current.length, take: PAGE_SIZE,
      });
      if (seq !== requestSeq.current) return;
      setRows((cur) => [...cur, ...page.rows]);
      setTotal(page.total);
    } catch { /* keep the rows already loaded */ }
    finally {
      loadingMoreRef.current = false;
    }
  }

  // Headline tiles — backend-computed for the selected tab + window; the
  // cash tile inside them is the whole book (filter-independent).
  useEffect(() => {
    let live = true;
    const w = windowFrom(month, year);
    fetchInsights(filter, w.from, w.to)
      .then((i) => { if (live) setInsights(i); })
      .catch(() => { /* the page keeps the last good tiles */ });
    return () => { live = false; };
  }, [filter, month, year]);

  /** The toolbar's Refresh button: reload the table in front of you. */
  async function refreshNow(): Promise<void> {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  /** The toolbar's Reset button: every table filter back to the page's
      opening state — Active tab, no search, all months, current year. */
  function resetFilters(): void {
    setFilter("Active");
    setSearch("");
    setMonth("all");
    setYear(String(new Date().getFullYear()));
  }

  // The Clear-filters control only earns toolbar space when something is
  // actually filtered — otherwise it sits dead between the date pickers.
  const filtersDirty =
    filter !== "Active" || search.trim() !== "" || month !== "all" ||
    year !== String(new Date().getFullYear());

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

  // The filter/sort/search all run on the server; the loaded `rows` are
  // already the page(s) to render — nothing is grouped or filtered here.

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

      {/* Toolbar — every control shares one 36px height. Filters read left
          to right (status · view · search · date window), then the count,
          then the actions; a hairline separates the groups. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3">
        {/* Status tab + view shape — segmented controls, one height. */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center rounded-lg border border-line bg-card p-[3px]">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`h-7 rounded-md px-3 text-sm font-medium transition-colors duration-300 ease-brand
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  filter === f ? "bg-primary text-on-primary shadow-sm" : "text-slate hover:bg-tint-hover"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex h-9 items-center rounded-lg border border-line bg-card p-[3px]">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                title={v === "Groups" ? "One row per collateral" : "Flat spreadsheet grid, one row per lend"}
                className={`flex h-7 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors duration-300 ease-brand
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  view === v ? "bg-primary text-on-primary shadow-sm" : "text-slate hover:bg-tint-hover"
                }`}
              >
                <i className={`ph ${v === "Groups" ? "ph-rows" : "ph-table"} text-base`} aria-hidden="true" />
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Search — grows to fill the row; the leading magnifier and the
            clear button make its state obvious. */}
        <div className="relative min-w-40 flex-1">
          <i
            className="ph ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-dim"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, item or date…"
            className={`${inputCls} pl-9 ${search ? "pr-9" : ""}`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-dim transition-colors duration-300 ease-brand
                         hover:bg-tint-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <i className="ph ph-x text-sm" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Date window + Clear filters (only while something is filtered). */}
        <div className="flex items-center gap-2">
          <MonthYearFilter
            month={month}
            year={year}
            years={years}
            onMonth={setMonth}
            onYear={setYear}
          />
          {filtersDirty && (
            <button
              onClick={resetFilters}
              className={iconBtnCls}
              title="Clear all filters"
              aria-label="Clear all filters"
            >
              <i className="ph ph-funnel-x text-lg" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* How many collaterals the filters match — the books at a glance. */}
        <span
          className="inline-flex h-9 items-center rounded-lg bg-tint px-3 text-sm font-medium text-ink"
          title="Collaterals matching these filters"
        >
          {total} {total === 1 ? "entry" : "entries"}
        </span>

        {/* Actions: reload, then writing (Admin/Lender only). */}
        <div className="flex items-center gap-2">
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <button
            onClick={refreshNow}
            disabled={refreshing}
            className={iconBtnCls}
            title="Reload the table"
            aria-label="Refresh"
          >
            <i
              className={`ph ph-arrows-clockwise text-lg ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
          {canEdit() && (
            <button onClick={() => setShowAdd(true)} className={primaryBtnCls}>
              <i className="ph ph-plus text-lg" aria-hidden="true" />
              Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Entries region — the only scrolling region on this page. Both
          views render the loaded pages of server-filtered rows; only the
          shape changes (grouped rows vs flat grid). */}
      {view === "Groups" ? (
        <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <EntryGroupTable
            groups={rows}
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
          <LoadMore visible={rows.length} total={total} onMore={loadMore} />
        </div>
      ) : (
        // Flat grid — same data, one row per lend, sorted by customer,
        // every data column editable in the cell.
        <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
          <GridTable
            groups={rows}
            customers={customers}
            loading={loading}
            readOnly={!canEdit()}
            statusTab={filter}
            flash={flash}
            onUpdate={(id, patch) => patchRow("lend", id, patch)}
            onPaymentUpdate={(id, patch) => patchRow("payment", id, patch)}
            onCustomerMove={moveGroup}
          />
          <LoadMore visible={rows.length} total={total} onMore={loadMore} />
        </div>
      )}

      {/* Dialogs */}
      <AddEntryDialog
        open={showAdd || Boolean(editing) || Boolean(subGroup)}
        entry={editing || undefined}
        group={subGroup || undefined}
        groups={rows.filter((g) => g.status === "Active")}
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