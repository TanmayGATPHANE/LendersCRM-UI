// In-memory stand-in for the .NET API — used when client.ts's USE_MOCK
// switch is on (demo/offline mode). Every function mirrors a real
// endpoint 1:1 (notes/requirements-plan.md §6); mockData.ts holds the
// sample records. Both are held to client.ts's DataLayer interface, so
// the switch really is a switch and the compiler keeps them in step.

import { cashLedger, customers, entries, partials, takeCustomerId, takeEntryId, takeLedgerId, takePartialId, takeUserId } from "./mockData.ts";
import type { AppUser, CashLedgerItem, Customer, Entry, Insights, Payment, SearchHit, SearchResults, UserItem } from "./types.ts";
import { accruedInterest } from "../utils/interest.ts";
import { allocatePaid } from "../utils/repayment.ts";

/** Mock /api/users store — Admin seeds it with a couple of co-workers. */
const mockUsers: UserItem[] = [
  { id: 1, name: "Admin", email: "admin@lenders.in", role: "Admin", isActive: true },
  { id: 2, name: "Rohan Mehta", email: "rohan@lenders.in", role: "Lender", isActive: true },
  { id: 3, name: "Sana Shaikh", email: "sana@lenders.in", role: "ViewOnly", isActive: true },
];

/** Mock POST /api/auth/login — the demo admin is the only account. */
export function mockLogin(email: string, password: string): Promise<AppUser> {
  const user: AppUser = { id: 1, name: "Admin", email: "admin@lenders.in", role: "Admin", token: "demo" };
  return new Promise((resolve, reject) => {
    setTimeout(
      () => (email === "admin@lenders.in" && password === "admin123"
        ? resolve(user)
        : reject(new Error("Invalid email or password"))),
      200
    );
  });
}

/** One customer joined with the counts the API derives (§3.2). */
function withStats(c: (typeof customers)[number]): Customer {
  // Groups of this customer: each contributes its active principal minus
  // its total partial returns.
  const mine = entries.filter((e) => e.customerId === c.id);
  const groupIds = [...new Set(mine.map((e) => e.groupId))];
  const outstanding = groupIds.reduce((s, gid) => {
    const group = entries.filter((e) => e.groupId === gid);
    const active = group.filter((e) => e.status === "Active").reduce((sum, e) => sum + e.amount, 0);
    const paid = partials.filter((p) => p.groupId === gid).reduce((sum, p) => sum + p.amount, 0);
    return s + Math.max(0, active - paid);
  }, 0);
  return {
    ...c,
    activeCount: mine.filter((e) => e.status === "Active").length,
    outstanding,
  };
}

/** Mock GET /api/customers -> list with counts derived from entries. */
export function mockFetchCustomers(): Promise<Customer[]> {
  return Promise.resolve(customers.map(withStats));
}

/** Mock POST /api/customers — create a customer, returns the new record. */
export function mockAddCustomer({ name, phone, address }: { name: string; phone: string; address: string }): Promise<Customer> {
  const customer = { id: takeCustomerId(), name, phone, address: address || "" };
  customers.push(customer);
  return Promise.resolve(withStats(customer));
}

/** Mock PUT /api/customers/{id} — update name / phone / address. */
export function mockUpdateCustomer(id: number, patch: Partial<Customer>): Promise<Customer> {
  return new Promise((resolve, reject) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return reject(new Error("Customer not found"));
    Object.assign(customer, { name: patch.name ?? customer.name, phone: patch.phone ?? customer.phone, address: patch.address ?? customer.address });
    resolve(withStats(customer));
  });
}

/** Mock POST /api/customers/find-or-create (§4.1). */
export function mockEnsureCustomer(name: string, address: string): Promise<Customer> {
  return new Promise((resolve) => {
    const found = customers.find(
      (c) => c.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );
    if (found) return resolve(withStats(found));
    const customer = { id: takeCustomerId(), name: String(name).trim(), phone: "", address: address ?? "" };
    customers.push(customer);
    resolve(withStats(customer));
  });
}

/** Mock GET /api/entries -> flat list joined with the customer name. */
export function mockFetchEntries(): Promise<Entry[]> {
  return Promise.resolve(
    entries.map((e) => {
      const c = customers.find((x) => x.id === e.customerId);
      return { ...e, customerName: c?.name ?? "?", customerAddress: c?.address ?? "" } as Entry;
    })
  );
}

/** Mock GET /api/payments -> every partial return recorded so far. */
export function mockFetchPartials(): Promise<Payment[]> {
  return Promise.resolve([...partials]);
}

/** Mock GET /api/insights?tab= — the three headline numbers, re-derived
    on every call with the same formulas the backend owns (§6); `tab`
    slices them per status exactly like InsightsService.GetAsync. */
export function mockFetchInsights(tab?: string): Promise<Insights> {
  return new Promise((resolve) => {
    // Financial year window — Indian FY runs 1 April to 31 March.
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = `${fyStartYear}-04-01`;
    const fyEnd = `${fyStartYear + 1}-03-31`;
    const inFY = (iso: string | null | undefined) => !!iso && iso >= fyStart && iso <= fyEnd;

    const activeGroupIds = new Set(
      entries.filter((e) => e.status === "Active").map((e) => e.groupId)
    );
    const activePrincipal = entries
      .filter((e) => e.status === "Active")
      .reduce((s, e) => s + e.amount, 0);

    const released = entries.filter((e) => e.status === "Released");
    const interestEarned = released
      .filter((e) => inFY(e.releasedDate))
      .reduce((s, e) => s + (e.interestCollected || 0), 0);

    // Per-tab slices — mirror InsightsService.GetAsync (active/released).
    const slice = (tab ?? "").toLowerCase();

    if (slice === "active") {
      const activeSubs = entries.filter((e) => e.status === "Active");
      const subsByGroup = new Map<number, typeof activeSubs>();
      for (const e of activeSubs) {
        if (!subsByGroup.has(e.groupId)) subsByGroup.set(e.groupId, []);
        subsByGroup.get(e.groupId)!.push(e);
      }
      // Interest accrues live on each lend's FIFO share of its group's
      // partials — the figure a release will freeze.
      let interestOut = 0;
      for (const subs of subsByGroup.values()) {
        const paidTotal = partials
          .filter((p) => p.groupId === subs[0].groupId)
          .reduce((s, p) => s + p.amount, 0);
        const paidMap = allocatePaid(subs as Entry[], paidTotal);
        for (const s of subs) interestOut += accruedInterest({ ...s, paid: paidMap.get(s.id) ?? 0 });
      }
      const receivedOnActive = partials
        .filter((p) => activeGroupIds.has(p.groupId))
        .reduce((s, p) => s + p.amount, 0);
      resolve({
        totalAmanat: Math.max(0, activePrincipal - receivedOnActive),
        interestEarned: interestOut,
        // Cash the drawer gave out on active collaterals: partials back
        // minus the lends (negative — it mirrors Total Amanat, §6).
        cashAvailable: receivedOnActive - activePrincipal,
      });
      return;
    }

    if (slice === "released") {
      const recovered = released.reduce(
        (s, x) => s + (x.amountReturned ?? x.amount) - (x.interestCollected ?? 0), 0
      );
      const collected = released.reduce((s, x) => s + (x.interestCollected ?? 0), 0);
      resolve({
        totalAmanat: Math.max(0, recovered),
        interestEarned: collected,
        cashAvailable: Math.max(0, recovered) + Math.max(0, collected),
      });
      return;
    }

    resolve({
      // Money in customers' hands: active lend − partials against
      // those still-active collaterals.
      totalAmanat: Math.max(
        0,
        activePrincipal -
          partials.filter((p) => activeGroupIds.has(p.groupId)).reduce((s, p) => s + p.amount, 0)
      ),
      interestEarned,
      // Total Cash Available IS the stored ledger (§3.5): lends out
      // (negative), partials, the two rows each release posts, and
      // manual ± — no re-derivation.
      cashAvailable: cashLedger.reduce((s, l) => s + l.amount, 0),
    });
  });
}

/** Mock POST /api/groups/{id}/payments — record a partial return (§4.6). */
export function mockAddPartial(groupId: number, { date, amount, notes }: { date: string; amount: number; notes: string }): Promise<Payment> {
  return new Promise((resolve, reject) => {
    const groupEntries = entries.filter((e) => e.groupId === groupId);
    const activePrincipal = groupEntries
      .filter((e) => e.status === "Active")
      .reduce((s, e) => s + e.amount, 0);
    const paid = partials
      .filter((p) => p.groupId === groupId)
      .reduce((s, p) => s + p.amount, 0);
    const remaining = activePrincipal - paid; // still out on this group
    if (!(Number(amount) > 0))
      return reject(new Error("Enter the amount received"));
    if (Number(amount) > remaining)
      return reject(new Error(`Partial return cannot exceed the outstanding ₹${remaining.toLocaleString("en-IN")}`));
    const record: Payment = { id: takePartialId(), groupId, date, amount: Number(amount), notes: notes || "" };
    partials.push(record);
    // The cash ledger books this money coming back, one row (§3.5).
    cashLedger.push({
      id: takeLedgerId(), date, amount: record.amount,
      source: "PartialReturn", groupId, referenceId: record.id, notes: record.notes,
    });
    resolve(record);
  });
}

/** Mock POST /api/entries — a new collateral (groupId = own id) or a
    sub-lend joining an existing collateral group (§4.3). */
export function mockAddEntry({ customerId, date, item, amount, rate, notes, groupId }: {
  customerId: number; date: string; item: string;
  amount: number; rate: number | null; notes: string; groupId?: number;
}): Promise<Entry> {
  const id = takeEntryId();
  const entry = {
    id,
    groupId: groupId ?? id,
    date,
    customerId,
    item,
    amount,
    rate: rate ? Number(rate) : null,
    notes: notes || "",
    status: "Active" as Entry["status"],
  } satisfies typeof entries[number];
  entries.push(entry);
  // The cash ledger books the money GOING OUT (§3.5): lending −amount.
  cashLedger.push({
    id: takeLedgerId(), date, amount: -amount, source: "Lend",
    groupId: entry.groupId, referenceId: id, notes: null,
  });
  return Promise.resolve(entry as Entry);
}

/** Mock PUT /api/entries/{id} — edit an entry (before release only). */
export function mockUpdateEntry(id: number, patch: {
  customerId?: number; item?: string; date?: string; amount?: number;
  rate?: number | "" | null; notes?: string;
}): Promise<Entry> {
  return new Promise((resolve, reject) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry || entry.status !== "Active")
      return reject(new Error("Only active entries can be edited"));
    Object.assign(entry, patch, { rate: patch.rate ? Number(patch.rate) : null });
    // A lend edit keeps its 'Lend' ledger row in step (date + amount).
    const ledgerRow = cashLedger.find((l) => l.source === "Lend" && l.referenceId === id);
    if (ledgerRow) { ledgerRow.date = entry.date; ledgerRow.amount = -entry.amount; }
    resolve(entry as Entry);
  });
}

/** Mock PUT /api/payments/{id} — edit a partial return (grid editing). */
export function mockUpdatePartial(id: number, patch: { date?: string; amount?: number; notes?: string }): Promise<Payment> {
  return new Promise((resolve, reject) => {
    const record = partials.find((p) => p.id === id);
    if (!record) return reject(new Error("Payment not found"));
    Object.assign(record, patch, patch.amount != null ? { amount: Number(patch.amount) } : {});
    if (!(record.amount > 0)) return reject(new Error("Amount must be greater than 0"));
    // The ledger row stays in step with the corrected payment (§3.5).
    const ledgerRow = cashLedger.find((l) => l.source === "PartialReturn" && l.referenceId === id);
    if (ledgerRow) Object.assign(ledgerRow, {
      date: record.date, amount: record.amount, notes: record.notes,
    });
    resolve(record);
  });
}

/** Mock PUT /api/groups/{id}/customer — move a whole collateral group. */
export async function mockUpdateGroupCustomer(groupId: number, customerId: number): Promise<void> {
  entries
    .filter((e) => e.groupId === groupId)
    .forEach((e) => { e.customerId = customerId; });
}

/** Mock POST /api/groups/{id}/release — release ALL active entries of one
    collateral group (§4.2/§4.6): each sub-lend freezes its own interest,
    the counter's books figure spreads proportionally, and totalCollected
    (what was ACTUALLY received) rides on the primary entry. */
export async function mockReleaseGroup(
  groupId: number,
  { dateReturned, interestCollected, totalCollected, notes }: {
    dateReturned: string; interestCollected: number | null | "";
    totalCollected: number; notes?: string;
  }
): Promise<void> {
  const groupEntries = entries.filter((e) => e.groupId === groupId);
  const active = groupEntries.filter((e) => e.status === "Active");
  if (active.length === 0) throw new Error("Group has no active lend");

  // Partial returns reduce each lend's principal first (FIFO), so
  // interest accrues — and freezes — on what is actually still out.
  const paidMap = allocatePaid(
    groupEntries as Entry[],
    partials.filter((p) => p.groupId === groupId).reduce((s, p) => s + p.amount, 0)
  );
  const accrued = active.map((e) =>
    accruedInterest({ ...e, paid: paidMap.get(e.id) ?? 0 } as Entry, dateReturned)
  );
  const due = accrued.reduce((s, x) => s + x, 0);
  // ""/null = collect exactly what is due; a number = what actually came in.
  const total = interestCollected == null || interestCollected === "" ? null : Number(interestCollected) || 0;
  // Proportional scale when the counter collected a different amount.
  const scale = due > 0 && total != null && total !== due ? total / due : 1;

  active.forEach((e, i) => {
    const frozen = Math.round(accrued[i] * scale);
    Object.assign(e, {
      status: "Released" as const,
      releasedDate: dateReturned,
      interestCollected: frozen,
      // Principal still out on this lend (after partial returns) + its interest.
      amountReturned: e.amount - (paidMap.get(e.id) ?? 0) + frozen,
      notes: notes || e.notes,
    });
  });
  // The actual cash received — one figure for the whole group.
  active[0].totalCollected = Number(totalCollected) || 0;

  // The release posts TWO ledger entries, dated the release day (§3.5):
  // the principal coming back and the interest collected.
  const principalBack = active.reduce((s, e) => s + (e.amountReturned ?? e.amount) - (e.interestCollected ?? 0), 0);
  const interestBack = active.reduce((s, e) => s + (e.interestCollected ?? 0), 0);
  cashLedger.push({ id: takeLedgerId(), date: dateReturned, amount: principalBack, source: "ReleasePrincipal", groupId, referenceId: null, notes: null });
  cashLedger.push({ id: takeLedgerId(), date: dateReturned, amount: interestBack, source: "ReleaseInterest", groupId, referenceId: null, notes: null });
}

/** Mock GET /api/cash-ledger — every row, oldest first (the page re-sorts). */
export function mockFetchCashLedger(): Promise<CashLedgerItem[]> {
  return Promise.resolve([...cashLedger].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id));
}

/** Mock POST /api/cash-ledger — a manual ± movement; amount is signed. */
export function mockAddManualCash({ date, amount, notes }: { date: string; amount: number; notes: string }): Promise<CashLedgerItem> {
  if (Number(amount) === 0)
    return Promise.reject(new Error("Enter the amount (with − in front for money taken out)"));
  const record: CashLedgerItem = {
    id: takeLedgerId(), date, amount: Number(amount),
    source: "Manual", groupId: null, referenceId: null, notes: notes || null,
  };
  cashLedger.push(record);
  return Promise.resolve(record);
}

/** Mock DELETE /api/cash-ledger/{id} — only manual (±) rows come off. */
export function mockDeleteCashEntry(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const row = cashLedger.find((l) => l.id === id);
    if (!row) return reject(new Error("Cash entry not found"));
    if (row.source !== "Manual")
      return reject(new Error("Only manual (±) cash entries can be deleted — lending rows belong to their lend/release records"));
    cashLedger.splice(cashLedger.indexOf(row), 1);
    resolve();
  });
}

/** Mock GET /api/users. */
export function mockFetchUsers(): Promise<UserItem[]> {
  return Promise.resolve([...mockUsers]);
}

/** Mock POST /api/users — duplicate email is a 409-shaped error like the API. */
export function mockAddUser({ name, email, password, role }: {
  name: string; email: string; password: string; role: UserItem["role"];
}): Promise<UserItem> {
  return new Promise((resolve, reject) => {
    if (!name?.trim()) return reject(new Error("Name is required"));
    if (!email?.trim()) return reject(new Error("Email is required"));
    if (!password) return reject(new Error("Password is required"));
    if (!["Admin", "Lender", "ViewOnly"].includes(role))
      return reject(new Error("Role must be Admin, Lender or ViewOnly"));
    if (mockUsers.some((u) => u.email === email.trim().toLowerCase()))
      return reject(new Error("A user with this email already exists"));
    const user: UserItem = { id: takeUserId(), name: name.trim(), email: email.trim().toLowerCase(), role, isActive: true };
    mockUsers.push(user);
    resolve(user);
  });
}

/** Mock PUT /api/users/{id} — enable/disable + optional password reset
    (passwords exist only in the demo admin here, so a reset is inert). */
export function mockUpdateUser(id: number, patch: {
  name?: string; role?: UserItem["role"]; isActive?: boolean; password?: string;
}): Promise<UserItem> {
  return new Promise((resolve, reject) => {
    const user = mockUsers.find((u) => u.id === id);
    if (!user) return reject(new Error("User not found"));
    if (patch.name != null) user.name = patch.name;
    if (patch.role != null) user.role = patch.role;
    if (patch.isActive != null) user.isActive = patch.isActive;
    resolve(user);
  });
}

/** The stored (signed-in) user's Admin flag — mirrors the real API's
    User.IsInRole("Admin") in SearchController. (Reads localStorage
    directly; importing back from client.ts would be a cycle.) */
function isAdminCaller(): boolean {
  try {
    const user = JSON.parse(localStorage.getItem("ams_user") ?? "null");
    return user?.role === "Admin";
  } catch {
    return false;
  }
}

/** Mock GET /api/search?q= — the header's global search, fanned out over
    customers / users / transactions with the same 3-char gate and caps as
    SearchService. */
export function mockGlobalSearch(q: string): Promise<SearchResults> {
  return new Promise((resolve) => {
    // The mock's raw entry records lack the API's derived fields (interest,
    // paid…) — the search works on the raw shape directly.
    type RawEntry = (typeof entries)[number];
    const s = q.trim().toLowerCase();
    if (s.length < 3) return resolve({ customers: [], users: [], transactions: [] });
    const numeric = s !== "" && !Number.isNaN(Number(s));

    const customersOut: SearchHit[] = customers
      .filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.address.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((c) => ({ id: c.id, type: "customer", title: c.name, subtitle: c.address, amount: null, groupId: null }));

    const usersOut: SearchHit[] = isAdminCaller()
      ? mockUsers
          .filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s))
          .slice(0, 5)
          .map((u) => ({ id: u.id, type: "user", title: u.name, subtitle: `${u.role} · ${u.email}`, amount: null, groupId: null }))
      : [];

    // groupId → the group's primary (earliest) lend, like the dashboard headline.
    const primaryByGroup = new Map<number, RawEntry>();
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id))
      if (!primaryByGroup.has(e.groupId)) primaryByGroup.set(e.groupId, e);

    const named = (e: RawEntry) => {
      const c = customers.find((x) => x.id === e.customerId);
      return `${c?.name ?? "?"} — ${e.item}`;
    };

    const lends: SearchHit[] = entries
      .filter((e) =>
        e.item.toLowerCase().includes(s)
        || named(e).toLowerCase().includes(s)
        || (e.notes ?? "").toLowerCase().includes(s)
        || (numeric && e.amount === Number(s)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(0, 8)
      .map((e) => {
        const primary = primaryByGroup.get(e.groupId)!;
        return {
          id: e.id, type: "lend" as const, title: named(primary),
          subtitle: `${e.date} · ${e.status}`, amount: primary.amount, groupId: e.groupId,
        };
      });

    const paymentsOut: SearchHit[] = partials
      .filter((p) =>
        (p.notes ?? "").toLowerCase().includes(s)
        || (numeric && p.amount === Number(s)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(0, 8)
      .map((p) => {
        const primary = primaryByGroup.get(p.groupId);
        return {
          id: p.id, type: "payment" as const, title: primary ? named(primary) : "? — ?",
          subtitle: `${p.date} · partial return`, amount: p.amount, groupId: p.groupId,
        };
      });

    resolve({ customers: customersOut, users: usersOut, transactions: [...lends, ...paymentsOut] });
  });
}