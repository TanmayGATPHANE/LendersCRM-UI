// Formatting helpers shared across pages.

/** Currency symbol shown everywhere. Change here to change app-wide. */
export const CURRENCY = "₹";

/** Format a number as currency without decimals (₹12,340). */
export function money(value: number | string | null | undefined): string {
  return CURRENCY + Number(value ?? 0).toLocaleString("en-IN");
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