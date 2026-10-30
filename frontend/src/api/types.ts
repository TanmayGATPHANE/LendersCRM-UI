// Shared domain types — mirror the .NET API's Contracts.cs one record per
// interface (plan §5/§6). Dates ride as ISO strings (yyyy-mm-dd); amounts
// as numbers (the API's decimals serialize to JSON numbers).

/** Auth/account roles (§2). ViewOnly can read everything, write nothing. */
export type Role = "Admin" | "Lender" | "ViewOnly";

/** A lend's lifecycle (§4). */
export type EntryStatus = "Active" | "Released";

/** What login returns: the user with the JWT riding along (stored user). */
export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  token: string; // JWT, present on the stored (signed-in) copy
}

/** GET/POST/PUT /api/users — a managed account (POST/PUT return this). */
export interface UserItem {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

/** GET/POST/PUT /api/customers — with the derived counts (§3.2). */
export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  activeCount: number;
  outstanding: number;
}

/** GET/POST/PUT /api/payments — a partial return (§4.6). */
export interface Payment {
  id: number;
  groupId: number;
  date: string;
  amount: number;
  notes: string | null;
}

/** GET /api/cash-ledger — one row of the Total Cash Available table (§3.5):
    every rupee moving over the counter is a STORED row. A lend books one
    negative row (money out), a release posts two (principal + interest,
    dated the release day), a partial return posts one, and a manual +/−
    drawer movement posts one signed row. SUM(Amount) = Total Cash
    Available — no page derives it. */
export type CashLedgerSource =
  | "Lend" | "PartialReturn" | "ReleasePrincipal" | "ReleaseInterest" | "Manual";

export interface CashLedgerItem {
  id: number;
  date: string;
  /** Signed for Manual (+ into the drawer / − out); positive for lending rows. */
  amount: number;
  source: CashLedgerSource;
  /** Links lending rows back to their collateral group; null for Manual. */
  groupId: number | null;
  /** PartialReturn rows: the payment record they were booked from. */
  referenceId: number | null;
  notes: string | null;
}

/** One lend as every table/dialog expects it (mirrors EntryItem). */
export interface Entry {
  id: number;
  groupId: number;
  customerId: number;
  customerName: string;
  customerAddress: string;
  date: string;
  item: string;
  amount: number;
  rate: number | null; // % per month; null = interest-free
  status: EntryStatus;
  /** Accrued live on outstanding principal (active); frozen once released. */
  interest: number;
  /** Principal already covered by partial returns (FIFO). */
  paid: number;
  notes: string;
  releasedDate: string | null;
  interestCollected: number | null;
  amountReturned: number | null;
  totalCollected: number | null; // actual counter cash, on the primary only
}

/** GET /api/insights?tab=all|active|released — the dashboard tiles. */
export interface Insights {
  totalAmanat: number;
  interestEarned: number;
  cashAvailable: number;
}

/** Which collateral a successful save landed on — dialogs hand this up to
    the page (through onSaved) so it can pulse the changed row(s) green. */
export interface SavedWhere {
  groupId?: number;
}

// ---- global search (the header box) ----

/** One hit of the header's global search. type: "customer" | "user" |
    "lend" | "payment"; amount rides on transaction hits; groupId is the
    jump-target (the collateral group) on lending rows. */
export type SearchHitType = "customer" | "user" | "lend" | "payment";

export interface SearchHit {
  id: number;
  type: SearchHitType;
  title: string;
  subtitle: string;
  amount: number | null;
  groupId: number | null;
}

/** Three sections for the dropdown — users is filled only for Admin. */
export interface SearchResults {
  customers: SearchHit[];
  users: SearchHit[];
  transactions: SearchHit[];
}

/** One collapsed collateral group (utils/grouping.ts buildGroups). */
export interface CollateralGroup {
  groupId: number;
  primary: Entry; // the earliest lend; the row headline shows its fields
  customerId: number;
  customerName: string;
  customerAddress: string;
  item: string;
  date: string;
  /** Every lend with `paid` attached (FIFO share of the group's partials). */
  subs: Entry[];
  partials: Payment[];
  activeSubs: Entry[];
  activePrincipal: number;
  totalPaid: number;
  outstanding: number;
  totalAmount: number;
  status: EntryStatus;
}

/** Form-state shape of the Add Entry dialog's fields. */
export interface EntryForm {
  customerId: string;
  customerName: string;
  customerAddress: string;
  date: string;
  item: string;
  amount: string;
  rate: string;
  notes: string;
}