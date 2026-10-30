// Seed data used by the mock API. Every function in api/client.ts reads
// from these arrays — the demo switch keeps this file alive alongside the
// real one (client.ts picks the implementation, nothing else changes).

import type { Entry, Payment } from "./types.ts";

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
    amountReturned: 7390, interestCollected: 570, releasedDate: "2026-10-25",
  },
  {
    id: 10, groupId: 10, date: "2026-09-05", customerId: 4,
    item: "Yamaha FZ Papers", amount: 22000, rate: 2, status: "Released", notes: "",
    amountReturned: 27280, interestCollected: 2933, releasedDate: "2026-10-22",
  },
  {
    id: 11, groupId: 11, date: "2026-08-14", customerId: 5,
    item: "Sony Soundbar", amount: 5500, rate: null, status: "Released", notes: "",
    amountReturned: 5500, interestCollected: 0, releasedDate: "2026-09-10",
  },
  {
    id: 12, groupId: 12, date: "2026-08-01", customerId: 6,
    item: "Gold Ring (4g)", amount: 9500, rate: 2, status: "Released", notes: "",
    amountReturned: 11800, interestCollected: 1150, releasedDate: "2026-10-15",
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