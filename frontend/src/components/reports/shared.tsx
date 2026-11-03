import type { ReactNode } from "react";

/**
 * Shared bits for the three Reports tables — one place for the header /
 * cell class strings, the month-label helpers and the empty state, so
 * the three table files stay free of boilerplate (and always match).
 */

/** Column header (left-aligned). text-left matters: <th> centers by default. */
export const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";

/** Column header (right-aligned money columns). */
export const thR = `${th} text-right`;

/** Data cell (left / right variants). */
export const td = "px-3 py-2";
export const tdR = `${td} text-right`;

/** "2026-10" → "Oct 2026". */
export function monthLabel(m: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, mm] = m.split("-");
  return `${MONTHS[Number(mm) - 1]} ${y}`;
}

/** The compact axis tick for a month — "Oct", or "Nov '25" the month the
    year turns, so a 12+ month axis keeps its orientation when the bands
    can't fit the full label. */
export function monthTick(m: string, prevMonth: string | null): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, mm] = m.split("-");
  const yearTurns = prevMonth === null || prevMonth.slice(0, 4) !== y;
  return yearTurns ? `${MONTHS[Number(mm) - 1]} '${y.slice(2)}` : MONTHS[Number(mm) - 1];
}

/** The empty-report state (same shape as the other pages'). */
export function Empty({ text }: { text: ReactNode | string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-12 text-center">
      <i className="ph ph-chart-bar text-2xl text-dim" aria-hidden="true" />
      <span className="text-sm text-slate">{text}</span>
    </div>
  );
}