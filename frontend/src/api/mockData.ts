// Seed data used by the mock API. Every function in api/client.ts reads
// from these arrays — the demo switch keeps this file alive alongside the
// real one (client.ts picks the implementation, nothing else changes).

import type { CashLedgerItem, Entry, Payment } from "./types.ts";

/** Demo customers. Phone is stored raw; formatting happens in the UI.
    activeCount/outstanding are derived by the mock fetch (like the API). */
export type MockCustomer = { id: number; name: string; phone: string; address: string };

/** Demo entries — what a released record additionally freezes
    (amountReturned / interestCollected / releasedDate / totalCollected). */
export type MockEntry = Omit<
  Entry,
  "customerName" | "customerAddress" | "interest" | "paid" |
  "releasedDate" | "interestCollected" | "amountReturned" | "totalCollected"
> & {
  releasedDate?: string;
  interestCollected?: number;
  amountReturned?: number;
  totalCollected?: number;
};

export const seedCustomers: MockCustomer[] = [
  { id: 1, name: "Tanmay", phone: "9871234567", address: "Thane" },
  { id: 2, name: "Ramesh Kumar", phone: "9845012345", address: "Dadar" },
  { id: 3, name: "Priya Sharma", phone: "9876502211", address: "Andheri" },
  { id: 4, name: "Arun Verma", phone: "9900112233", address: "Nerul" },
  { id: 5, name: "Deepa Iyer", phone: "9632587410", address: "Powai" },
  { id: 6, name: "Mohan Das", phone: "9700223344", address: "Vashi" },
];

/**
 * Demo entries.
 * Shape matches what the .NET API returns (notes/requirements-plan.md §5):
 * - groupId: every entry belongs to a collateral group. The first lend
 *   against a collateral creates the group (groupId = its own id); later
 *   top-up lends join the same group and copy the item description.
 * - status: "Active" | "Released"
 * - rate: interest rate in % per month, or null (no interest)
 * - released entries freeze interest into interestCollected
 */
export const seedEntries: MockEntry[] = [
  // Tanmay's gold chain — two lends against one collateral (shows "+1")
  {
    id: 1, groupId: 1, date: "2026-08-30", customerId: 1,
    item: "Gold Chain (12g)", amount: 5000, rate: 2, status: "Active", notes: "",
  },
  {
    id: 2, groupId: 1, date: "2026-10-28", customerId: 1,
    item: "Gold Chain (12g)", amount: 2000, rate: 2, status: "Active",
    notes: "Top-up on the same chain",
  },

  // Single-lend collateral groups
  {
    id: 3, groupId: 3, date: "2026-10-28", customerId: 2,
    item: "Gold Chain (15g)", amount: 40000, rate: 2, status: "Active", notes: "",
  },
  {
    id: 4, groupId: 4, date: "2026-10-26", customerId: 3,
    item: "iPhone 13", amount: 25000, rate: 2, status: "Active", notes: "",
  },
  {
    id: 5, groupId: 5, date: "2026-10-24", customerId: 4,
    item: 'Samsung TV 55"', amount: 8500, rate: null, status: "Active",
    notes: "Interest free",
  },
  {
    id: 6, groupId: 6, date: "2026-10-20", customerId: 5,
    item: "Laptop - Dell Inspiron", amount: 15000, rate: 1.5, status: "Active", notes: "",
  },
  {
    id: 7, groupId: 7, date: "2026-10-15", customerId: 6,
    item: "Silver Coin Set", amount: 6200, rate: 2, status: "Active", notes: "",
  },
  {
    id: 8, groupId: 8, date: "2026-09-30", customerId: 3,
    item: "Honda Activa Papers", amount: 30000, rate: 2, status: "Active", notes: "",
  },

  // Released history
  {
    id: 9, groupId: 9, date: "2026-09-12", customerId: 2,
    item: "Rado Watch", amount: 6500, rate: 1, status: "Released", notes: "",
    amountReturned: 7070, interestCollected: 570, releasedDate: "2026-10-25", totalCollected: 7070,
  },
  {
    id: 10, groupId: 10, date: "2026-09-05", customerId: 4,
    item: "Yamaha FZ Papers", amount: 22000, rate: 2, status: "Released", notes: "",
    amountReturned: 24933, interestCollected: 2933, releasedDate: "2026-10-22", totalCollected: 24933,
  },
  {
    id: 11, groupId: 11, date: "2026-08-14", customerId: 5,
    item: "Sony Soundbar", amount: 5500, rate: null, status: "Released", notes: "",
    amountReturned: 5500, interestCollected: 0, releasedDate: "2026-09-10", totalCollected: 5500,
  },
  {
    id: 12, groupId: 12, date: "2026-08-01", customerId: 6,
    item: "Gold Ring (4g)", amount: 9500, rate: 2, status: "Released", notes: "",
    amountReturned: 10650, interestCollected: 1150, releasedDate: "2026-10-15", totalCollected: 10650,
  },
];

/** Last id assigned — addEntry keeps going from here. */
let nextUserId = 4;
let nextCustomerId = 7;
let nextEntryId = 13;
let nextPartialId = 3;

export function takeUserId(): number {
  return nextUserId++;
}

export function takeCustomerId(): number {
  return nextCustomerId++;
}

export function takeEntryId(): number {
  return nextEntryId++;
}

export function takePartialId(): number {
  return nextPartialId++;
}

/**
 * Demo partial returns (§4.6): money the customer handed back early
 * against a collateral group. Stored as payment records; they reduce the
 * group's outstanding principal (oldest lend first) but keep the lend
 * records themselves intact.
 */
export const seedPartials: Payment[] = [
  {
    id: 1, groupId: 8, date: "2026-10-10", // Priya · Honda Activa Papers
    amount: 10000, notes: "Cash on Dussehra",
  },
  {
    id: 2, groupId: 1, date: "2026-10-20", // Tanmay · Gold Chain (12g)
    amount: 2500, notes: "First instalment",
  },
];

/** Mutable working copies so the mock behaves like a real backend. */
export const customers: MockCustomer[] = [...seedCustomers];
export const entries: MockEntry[] = [...seedEntries];
export const partials: Payment[] = [...seedPartials];

/**
 * Demo cash ledger (§3.5) — the Total Cash Available table itself.
 * One negative row per LEND (money out); one row per partial return; TWO
 * rows per released collateral (principal and interest, dated the release
 * day; principal = amountReturned − interestCollected); signed manual ±
 * rows. SUM(amount) is the balance in hand, same rule as the backend's
 * CashLedger.
 */
export const seedCashLedger: CashLedgerItem[] = [
  // Lends — money going out, one row per lend (referenceId = entry id)
  { id: 1, date: "2026-08-01", amount: -9500, source: "Lend", groupId: 12, referenceId: 12, notes: null },
  { id: 2, date: "2026-08-14", amount: -5500, source: "Lend", groupId: 11, referenceId: 11, notes: null },
  { id: 3, date: "2026-08-30", amount: -5000, source: "Lend", groupId: 1, referenceId: 1, notes: null },
  { id: 4, date: "2026-09-05", amount: -22000, source: "Lend", groupId: 10, referenceId: 10, notes: null },
  { id: 5, date: "2026-09-12", amount: -6500, source: "Lend", groupId: 9, referenceId: 9, notes: null },
  { id: 6, date: "2026-09-30", amount: -30000, source: "Lend", groupId: 8, referenceId: 8, notes: null },
  { id: 7, date: "2026-10-15", amount: -6200, source: "Lend", groupId: 7, referenceId: 7, notes: null },
  { id: 8, date: "2026-10-20", amount: -15000, source: "Lend", groupId: 6, referenceId: 6, notes: null },
  // Partial returns (referenceId = the seed partial's id)
  { id: 9, date: "2026-10-10", amount: 10000, source: "PartialReturn", groupId: 8, referenceId: 1, notes: "Cash on Dussehra" },
  { id: 10, date: "2026-10-20", amount: 2500, source: "PartialReturn", groupId: 1, referenceId: 2, notes: "First instalment" },
  // Releases — the two entries each one posts
  { id: 11, date: "2026-10-25", amount: 6500, source: "ReleasePrincipal", groupId: 9, referenceId: null, notes: null },
  { id: 12, date: "2026-10-25", amount: 570, source: "ReleaseInterest", groupId: 9, referenceId: null, notes: null },
  { id: 13, date: "2026-10-22", amount: 22000, source: "ReleasePrincipal", groupId: 10, referenceId: null, notes: null },
  { id: 14, date: "2026-10-22", amount: 2933, source: "ReleaseInterest", groupId: 10, referenceId: null, notes: null },
  { id: 15, date: "2026-09-10", amount: 5500, source: "ReleasePrincipal", groupId: 11, referenceId: null, notes: null },
  { id: 16, date: "2026-09-10", amount: 0, source: "ReleaseInterest", groupId: 11, referenceId: null, notes: null },
  { id: 17, date: "2026-10-15", amount: 9500, source: "ReleasePrincipal", groupId: 12, referenceId: null, notes: null },
  { id: 18, date: "2026-10-15", amount: 1150, source: "ReleaseInterest", groupId: 12, referenceId: null, notes: null },
  // The remaining active lends went out more recently
  { id: 19, date: "2026-10-24", amount: -8500, source: "Lend", groupId: 5, referenceId: 5, notes: null },
  { id: 20, date: "2026-10-26", amount: -25000, source: "Lend", groupId: 4, referenceId: 4, notes: null },
  { id: 21, date: "2026-10-27", amount: -40000, source: "Lend", groupId: 3, referenceId: 3, notes: null },
  { id: 22, date: "2026-10-28", amount: -2000, source: "Lend", groupId: 1, referenceId: 2, notes: null },
  // Manual drawer movements — + in / − out, outside the business
  { id: 23, date: "2026-10-27", amount: -500, source: "Manual", groupId: null, referenceId: null, notes: "Chai / misc from drawer" },
];

let nextLedgerId = 24;

export function takeLedgerId(): number {
  return nextLedgerId++;
}

/** Mutable working copy — mockPartial/mockRelease/mockManual write here. */
export const cashLedger: CashLedgerItem[] = [...seedCashLedger];