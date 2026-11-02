// Formatting helpers shared across pages.

/** Currency symbol shown everywhere. Change here to change app-wide. */
export const CURRENCY = "₹";

/** Format a number as currency without decimals (₹12,340). */
export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const sign = n < 0 ? "−" : "";
  return sign + CURRENCY + Math.abs(n).toLocaleString("en-IN");
}

/** Format an ISO date string (yyyy-mm-dd) as a short human date. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Today's date as an ISO string (yyyy-mm-dd) for date inputs. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The current month as an inclusive ISO window (its 1st to its last
    day) — what every page's date filter opens on, so a big book loads
    only the fresh slice instead of everything. */
export function currentMonthWindow(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
}