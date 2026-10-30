// Passbook-style ledger for one collateral group (see §4.6 of the plan).
//
// One row per money movement — lends (+), partial returns (−) and, for
// released collaterals, the final settlement — in date order. Every row
// also carries the interest that accrued on the RUNNING BALANCE from its
// own date until the next movement's date ("present" while the collateral
// is still out, the release date for a closed one). That is what makes
// the ledger add up:
//
//   1 Jan   +5000   interest 200  till 1 Mar   (5000 × 2%/mo × 2 months)
//   1 Mar   −2500   interest   …  till 1 Apr   (balance after payment)
//   1 Apr   +2000   interest   …  present      (running balance accruing)
//   Running         balance          Σ interest
//
// Returns { rows, balance, interest }: the movement rows, the running
// amount (net of what went out minus what came back) and the total
// interest accrued across the intervals.

import type { CollateralGroup, EntryStatus } from "../api/types.ts";
import { daysBetween } from "./interest.ts";
import { today, shortDate } from "./format.ts";

/** One row of the ledger — a lend, a payment, or a release settlement. */
export interface LedgerRow {
  key: string;
  id: number | null;
  kind: "lend" | "payment" | "settlement";
  date: string;
  amount: number;
  rate: number | null; // lends only
  notes: string;
  status: EntryStatus | null;
  isReceived: boolean; // payment or settlement — money coming back
  balance: number;
  interest: number;
  untilText: string;
}

export function buildLedger(group: CollateralGroup): {
  rows: LedgerRow[];
  balance: number;
  interest: number;
} {
  const released = group.status === "Released";
  const stopDate = released ? group.primary.releasedDate ?? null : null;
  const nowIso = today();

  // Movements: lends and partial returns, plus the release settlement
  // (the principal actually handed back on release day — its interest is
  // already covered by the accrued interest of the last interval).
  const movements: LedgerRow[] = [
    ...group.subs.map<LedgerRow>((s) => ({
      key: `l-${s.id}`, id: s.id, kind: "lend",
      date: s.date, amount: s.amount, rate: s.rate ?? null,
      notes: s.notes || "", status: s.status,
      isReceived: false, balance: 0, interest: 0, untilText: "",
    })),
    ...group.partials.map<LedgerRow>((p) => ({
      key: `p-${p.id}`, id: p.id, kind: "payment",
      date: p.date, amount: p.amount, rate: null,
      notes: p.notes || "", status: null,
      isReceived: true, balance: 0, interest: 0, untilText: "",
    })),
  ];
  if (released) {
    const principalBack = group.subs.reduce(
      (s, e) => s + (e.amountReturned ?? 0) - (e.interestCollected ?? 0),
      0
    );
    movements.push({
      key: "settlement", id: null, kind: "settlement",
      date: stopDate ?? nowIso, amount: principalBack, rate: null,
      notes: "Release settlement", status: null,
      isReceived: true, balance: 0, interest: 0, untilText: "",
    });
  }

  // Date ascending; on a tie a lend sorts before that day's payment.
  movements.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === "lend" ? 0 : 1) - (b.kind === "lend" ? 0 : 1)
  );

  // Walk the movements. Each lend keeps its own outstanding (`left`); a
  // payment reduces the outstanding lends oldest-first (FIFO, §4.6) —
  // so interest always accrues on what is actually still out.
  const lends: { rate: number; left: number }[] = [];
  let balance = 0;
  let interestTotal = 0;

  const rows = movements.map((m, i) => {
    if (m.kind === "lend") {
      lends.push({ rate: m.rate ?? 0, left: m.amount });
    } else {
      let left = m.amount;
      for (const L of lends) {
        const take = Math.min(left, L.left);
        L.left -= take;
        left -= take;
      }
    }
    balance = lends.reduce((s, L) => s + L.left, 0);

    // This row's interval runs until the next movement — or, for the
    // last row, until the release date (closed) / today (still active).
    const nextDate: string | null =
      i + 1 < movements.length ? movements[i + 1].date : stopDate ?? nowIso;
    const days = Math.max(0, daysBetween(m.date, nextDate));
    const interest = Math.round(
      lends.reduce((s, L) => s + L.left * ((L.rate / 100) * (days / 30)), 0)
    );
    interestTotal += interest;

    return {
      ...m,
      isReceived: m.kind !== "lend", // payment or settlement → negative
      balance,
      interest,
      untilText:
        m.kind === "settlement" ? "—"
        : i === movements.length - 1 && !released ? "present"
        : nextDate ? `till ${shortDate(nextDate)}`
        : "present",
    };
  });

  return { rows, balance, interest: interestTotal };
}