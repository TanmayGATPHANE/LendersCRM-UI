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

/** Timestamps are STORED in UTC (plan §9) and shown in INDIAN time —
    always Asia/Kolkata, never the viewer's device zone, so every user
    sees the counter's clock ("18 Nov, 9:45 pm"). DATE-only columns
    (lend dates etc.) stay unshifted: they carry no time of day. */
export function istWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** Local ISO date (yyyy-mm-dd) — the shape every from/to API takes. */
export function fmtISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The inclusive from/to window a month/year filter pair stands for:
    "all" + "all" → the whole book ({}); a month → its first..last day;
    a month "all" with a year → Jan 1 .. Dec 31 of that year. */
export function windowFrom(month: string, year: string): { from?: string; to?: string } {
  if (month === "all" && year === "all") return {};
  const y = Number(year);
  if (month === "all") return { from: `${y}-01-01`, to: `${y}-12-31` };
  const m = Number(month); // 1..12
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

/** Today's date as an ISO string (yyyy-mm-dd) for date inputs. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}