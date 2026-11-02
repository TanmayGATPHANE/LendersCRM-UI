// Data layer for the whole UI. Every screen calls these functions instead
// of hitting fetch() directly, so the data source is one file and the
// React pages never change either way.
//
// ── THE DEMO SWITCH ──────────────────────────────────────────────────────
//   USE_MOCK=true  → in-memory sample data (demo/offline, no server).
//   USE_MOCK=false → the real .NET API (default). Backend must be running:
//                    `dotnet run` in ../lenders-crm-backend/Api, port 5246.
//   Flip the default here, or for a single session start Vite with
//   VITE_USE_MOCK=1 (e.g. `npm run dev -- --mode` + .env.local:
//   VITE_USE_MOCK=1). Base URL moves with VITE_API_URL.

import {
  mockLogin, mockFetchCustomers, mockAddCustomer, mockUpdateCustomer,
  mockEnsureCustomer, mockFetchEntries, mockFetchPartials, mockFetchInsights,
  mockAddPartial, mockAddEntry, mockUpdateEntry, mockUpdatePartial,
  mockUpdateGroupCustomer, mockReleaseGroup, mockFetchCashLedger, mockFetchCashTotal,
  mockAddManualCash, mockDeleteCashEntry, mockFetchUsers, mockAddUser,
  mockUpdateUser, mockGlobalSearch, mockReportSummary, mockReportCustomers,
  mockReportReleases, mockFetchActivity,
} from "./mockApi.ts";
import type {
  AppUser, CashLedgerItem, Customer, Entry, Insights, Payment, Role, UserItem,
  SearchResults, SummaryRow, CustomerReportRow, ReleaseReportRow, ActivityItem,
} from "./types.ts";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";
const BASE: string = import.meta.env.VITE_API_URL ?? "http://localhost:5246";

const TOKEN_KEY = "ams_user";

/** Read the currently signed-in user (null = not signed in). */
export function currentUser(): AppUser | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null") as AppUser | null;
  } catch {
    return null;
  }
}

/** Persist or clear the signed-in user (real mode stores the token here). */
export function setUser(user: AppUser | null): void {
  user
    ? localStorage.setItem(TOKEN_KEY, JSON.stringify(user))
    : localStorage.removeItem(TOKEN_KEY);
}

/** May the signed-in user change the books? View-only accounts can
    browse everything but never lend, edit or release. */
export function canEdit(): boolean {
  const role = currentUser()?.role;
  return role === "Admin" || role === "Lender";
}

/** Only the Admin sees the audit trail: the Activity tab and the
    per-collateral history panel both ride the Admin-only endpoint. */
export function isAdmin(): boolean {
  return currentUser()?.role === "Admin";
}

/** One fetch with the stored JWT attached; errors surface as Error(msg)
    where msg is the API's `{ message }` — the dialogs display it as-is.
    A 401 mid-session means the token expired: sign the user out and send
    them to login. */
async function http<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = currentUser()?.token;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 && !path.startsWith("/api/auth/login") && !USE_MOCK) {
    setUser(null);
    if (window.location.pathname !== "/login") window.location.assign("/login");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const json = await res.json();
      message = json.message ?? json.title ?? message;
    } catch { /* non-JSON error body — keep the fallback text */ }
    throw new Error(message);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/** The data layer's complete contract — the real API and the mock both
    implement this, so `USE_MOCK` really is a pure toggle. Every function
    below mirrors one endpoint in plan §6. */
interface DataLayer {
  login(email: string, password: string): Promise<AppUser>;

  fetchCustomers(): Promise<Customer[]>;
  addCustomer(values: { name: string; phone: string; address: string }): Promise<Customer>;
  updateCustomer(id: number, patch: Partial<Customer>): Promise<Customer>;
  ensureCustomer(name: string, address: string): Promise<Customer>;

  fetchEntries(): Promise<Entry[]>;
  fetchPartials(): Promise<Payment[]>;
  fetchInsights(tab?: string): Promise<Insights>;

  // The header's global search — one endpoint fanning out across customers,
  // users and transactions. The server drops anything under 3 characters.
  fetchGlobalSearch(q: string): Promise<SearchResults>;

  // The Total Cash Available table (§3.5) — every rupee in hand as stored
  // rows. The list takes an optional inclusive LedgerDate window so the
  // page pulls only the slice it shows; the total is always SUM over the
  // WHOLE table (the real cash in hand, window-independent). Manual ±
  // entries are the only rows a user can add or delete; the lending rows
  // are posted by the backend with the books.
  fetchCashLedger(from?: string, to?: string): Promise<CashLedgerItem[]>;
  fetchCashTotal(): Promise<number>;
  addManualCash(values: { date: string; amount: number; notes: string }): Promise<CashLedgerItem>;
  deleteCashEntry(id: number): Promise<void>;

  addPartial(groupId: number, values: { date: string; amount: number; notes: string }): Promise<Payment>;
  addEntry(values: {
    customerId?: number; date: string; item: string;
    amount: number; rate: number | null; notes: string; groupId?: number;
  }): Promise<{ id: number; groupId: number }>;
  updateEntry(id: number, patch: {
    customerId?: number; item?: string; date?: string; amount?: number;
    rate?: number | "" | null; notes?: string;
  }): Promise<{ id: number; groupId: number }>;
  updatePartial(id: number, patch: { date?: string; amount?: number; notes?: string }): Promise<Payment>;

  updateGroupCustomer(groupId: number, customerId: number): Promise<void>;
  releaseGroup(groupId: number, values: {
    dateReturned: string; interestCollected: number | null | "";
    totalCollected: number; notes?: string;
  }): Promise<void>;

  fetchUsers(): Promise<UserItem[]>;
  addUser(values: { name: string; email: string; password: string; role: Role }): Promise<UserItem>;
  updateUser(id: number, patch: { name?: string; role?: Role; isActive?: boolean; password?: string }): Promise<UserItem>;

  // The Reports page (§3.6) — read-only, all rows backend-computed. The
  // window (`from`/`to`, ISO dates, inclusive) is the page's global
  // calendar; nulls mean all time.
  fetchReportSummary(from?: string, to?: string): Promise<SummaryRow[]>;
  fetchReportCustomers(from?: string, to?: string): Promise<CustomerReportRow[]>;
  fetchReportReleases(from?: string, to?: string): Promise<ReleaseReportRow[]>;

  // The audit trail (§10) — Admin only at the controller. userId filters
  // the Activity tab to one user's trail; groupId pulls everything that
  // happened on one collateral group (the expanded-row history panel).
  fetchActivity(userId?: number, groupId?: number): Promise<ActivityItem[]>;
}

/** The real backend, one entry per endpoint in plan §6 — same function
    names the mock had, so pages are untouched by the switch. */
const api: DataLayer = {
  /** POST /api/auth/login -> { token, user }. The token rides INSIDE the
      returned user too — the Login page re-stores the returned value
      (setUser), so a separate store would lose it. */
  async login(email, password) {
    const r = await http<{ token: string; user: Omit<AppUser, "token"> }>(
      "/api/auth/login", { method: "POST", body: { email, password } }
    );
    const stored: AppUser = { ...r.user, token: r.token };
    setUser(stored);
    return stored;
  },

  fetchCustomers: () => http<Customer[]>("/api/customers"),

  addCustomer: ({ name, phone, address }) =>
    http<Customer>("/api/customers", { method: "POST", body: { name, phone, address } }),

  updateCustomer: (id, patch) =>
    http<Customer>(`/api/customers/${id}`, { method: "PUT", body: patch }),

  ensureCustomer: (name, address) =>
    http<Customer>("/api/customers/find-or-create", { method: "POST", body: { name, address } }),

  fetchEntries: () => http<Entry[]>("/api/entries"),

  fetchPartials: () => http<Payment[]>("/api/payments"),

  /** ?tab=all (default) | active | released — the tab shapes the tiles. */
  fetchInsights: (tab) =>
    http<Insights>(`/api/insights${tab && tab !== "All" ? `?tab=${tab.toLowerCase()}` : ""}`),

  fetchGlobalSearch: (q) => http<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),

  fetchCashLedger: (from, to) =>
    http<CashLedgerItem[]>(`/api/cash-ledger?${reportWindowQuery(from, to)}`),

  fetchCashTotal: () => http<number>("/api/cash-ledger/total"),

  addManualCash: ({ date, amount, notes }) =>
    http<CashLedgerItem>("/api/cash-ledger", {
      method: "POST", body: { date, amount: Number(amount), notes },
    }),

  deleteCashEntry: (id) =>
    http<void>(`/api/cash-ledger/${id}`, { method: "DELETE" }),

  addPartial: (groupId, { date, amount, notes }) =>
    http<Payment>(`/api/groups/${groupId}/payments`, {
      method: "POST", body: { date, amount: Number(amount), notes },
    }),

  // POST /api/entries — body carries groupId only for a sub-lend; a fresh
  // entry sends none and the backend makes GroupId = its own id (§4.3).
  addEntry: ({ customerId, date, item, amount, rate, notes, groupId }) =>
    http<{ id: number; groupId: number }>("/api/entries", {
      method: "POST",
      body: { customerId, date, item, amount: Number(amount), rate, notes, groupId },
    }),

  /** PUT /api/entries/{id} — Rate is a string over the wire: null/"" both
      mean interest-free, a number (as string) sets it (backend §6 note). */
  updateEntry: (id, patch) => {
    const { rate, ...rest } = patch;
    const body: Record<string, unknown> = { ...rest };
    if (patch.amount != null) body.amount = Number(patch.amount);
    if (rate != null) body.rate = rate === "" ? "" : String(rate);
    return http<{ id: number; groupId: number }>(`/api/entries/${id}`, { method: "PUT", body });
  },

  updatePartial: (id, patch) =>
    http<Payment>(`/api/payments/${id}`, {
      method: "PUT",
      body: {
        ...(patch.date ? { date: patch.date } : {}),
        ...(patch.amount != null ? { amount: Number(patch.amount) } : {}),
        ...(patch.notes != null ? { notes: patch.notes } : {}),
      },
    }),

  updateGroupCustomer: (groupId, customerId) =>
    http<void>(`/api/groups/${groupId}/customer`, { method: "PUT", body: { customerId } }),

  /** POST /api/groups/{id}/release — InterestCollected null = collect
      exactly what is due; TotalCollected is the counter's actual cash. */
  releaseGroup: (groupId, { dateReturned, interestCollected, totalCollected, notes }) =>
    http<void>(`/api/groups/${groupId}/release`, {
      method: "POST",
      body: {
        dateReturned,
        interestCollected: interestCollected == null || interestCollected === "" ? null : Number(interestCollected),
        totalCollected: Number(totalCollected) || 0,
        notes,
      },
    }),

  // Users management — Admin only (the /api/users* routes are Admin).
  fetchUsers: () => http<UserItem[]>("/api/users"),

  addUser: ({ name, email, password, role }) =>
    http<UserItem>("/api/users", { method: "POST", body: { name, email, password, role } }),

  updateUser: (id, patch) =>
    http<UserItem>(`/api/users/${id}`, { method: "PUT", body: patch }),

  fetchReportSummary: (from, to) =>
    http<SummaryRow[]>(`/api/reports/summary?${reportWindowQuery(from, to)}`),

  fetchReportCustomers: (from, to) =>
    http<CustomerReportRow[]>(`/api/reports/customers?${reportWindowQuery(from, to)}`),

  fetchReportReleases: (from, to) =>
    http<ReleaseReportRow[]>(`/api/reports/releases?${reportWindowQuery(from, to)}`),

  fetchActivity: (userId, groupId) => {
    const p = new URLSearchParams();
    if (userId) p.set("userId", String(userId));
    if (groupId) p.set("groupId", String(groupId));
    const qs = p.toString();
    return http<ActivityItem[]>(`/api/activity${qs ? `?${qs}` : ""}`);
  },
};

/** Query string for the windows (reports calendar, cash-ledger window) —
    empty when unbounded. */
function reportWindowQuery(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  return p.toString();
}

/** The mock pair — same names, so the switch below is a pure toggle. */
const mock: DataLayer = {
  async login(email, password) {
    const user = await mockLogin(email, password);
    setUser(user);
    return user;
  },
  fetchCustomers: mockFetchCustomers,
  addCustomer: mockAddCustomer,
  updateCustomer: mockUpdateCustomer,
  ensureCustomer: mockEnsureCustomer,
  fetchEntries: mockFetchEntries,
  fetchPartials: mockFetchPartials,
  fetchInsights: mockFetchInsights,
  fetchGlobalSearch: mockGlobalSearch,
  fetchCashLedger: mockFetchCashLedger,
  fetchCashTotal: mockFetchCashTotal,
  addManualCash: mockAddManualCash,
  deleteCashEntry: mockDeleteCashEntry,
  addPartial: mockAddPartial,
  addEntry: mockAddEntry,
  updateEntry: mockUpdateEntry,
  updatePartial: mockUpdatePartial,
  updateGroupCustomer: mockUpdateGroupCustomer,
  releaseGroup: mockReleaseGroup,
  fetchUsers: mockFetchUsers,
  addUser: mockAddUser,
  updateUser: mockUpdateUser,
  fetchReportSummary: mockReportSummary,
  fetchReportCustomers: mockReportCustomers,
  fetchReportReleases: mockReportReleases,
  fetchActivity: mockFetchActivity,
};

const impl: DataLayer = USE_MOCK ? mock : api;

/* Every export the pages use — real backend by default, mock when switched. */
export const login = (email: string, password: string) => impl.login(email, password);
export const fetchCustomers = () => impl.fetchCustomers();
export const addCustomer = (values: { name: string; phone: string; address: string }) => impl.addCustomer(values);
export const updateCustomer = (id: number, patch: Partial<Customer>) => impl.updateCustomer(id, patch);
export const ensureCustomer = (name: string, address: string) => impl.ensureCustomer(name, address);
export const fetchEntries = () => impl.fetchEntries();
export const fetchPartials = () => impl.fetchPartials();
export const fetchInsights = (tab?: string) => impl.fetchInsights(tab);
export const fetchGlobalSearch = (q: string) => impl.fetchGlobalSearch(q);
export const fetchCashLedger = (from?: string, to?: string) => impl.fetchCashLedger(from, to);
export const fetchCashTotal = () => impl.fetchCashTotal();
export const fetchActivity = (userId?: number, groupId?: number) => impl.fetchActivity(userId, groupId);
export const addManualCash =
  (values: { date: string; amount: number; notes: string }) => impl.addManualCash(values);
export const deleteCashEntry = (id: number) => impl.deleteCashEntry(id);
export const addPartial = (groupId: number, values: { date: string; amount: string | number; notes: string }) =>
  impl.addPartial(groupId, { ...values, amount: Number(values.amount) });
export const addEntry = (values: {
  customerId?: number; date: string; item: string;
  amount: string | number; rate: number | null; notes: string; groupId?: number;
}) => impl.addEntry({ ...values, amount: Number(values.amount) });
export const updateEntry = (id: number, patch: Parameters<DataLayer["updateEntry"]>[1]) => impl.updateEntry(id, patch);
export const updatePartial = (id: number, patch: { date?: string; amount?: string | number; notes?: string }) =>
  impl.updatePartial(id, {
    ...(patch.date ? { date: patch.date } : {}),
    ...(patch.amount != null ? { amount: Number(patch.amount) } : {}),
    ...(patch.notes != null ? { notes: patch.notes } : {}),
  });
export const updateGroupCustomer = (groupId: number, customerId: number) => impl.updateGroupCustomer(groupId, customerId);
export const releaseGroup = (groupId: number, values: Parameters<DataLayer["releaseGroup"]>[1]) => impl.releaseGroup(groupId, values);
export const fetchUsers = () => impl.fetchUsers();
export const addUser = (values: { name: string; email: string; password: string; role: Role }) => impl.addUser(values);
export const updateUser = (id: number, patch: { name?: string; role?: Role; isActive?: boolean; password?: string }) => impl.updateUser(id, patch);
export const fetchReportSummary = (from?: string, to?: string) => impl.fetchReportSummary(from, to);
export const fetchReportCustomers = (from?: string, to?: string) => impl.fetchReportCustomers(from, to);
export const fetchReportReleases = (from?: string, to?: string) => impl.fetchReportReleases(from, to);