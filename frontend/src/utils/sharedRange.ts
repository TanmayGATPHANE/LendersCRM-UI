import { fmtISO, presetWindow } from "../components/DateRangePicker.tsx";
import type { DateRange } from "../components/DateRangePicker.tsx";

/** ONE window for the whole app (Dashboard, Reports, Cash, Activity):
    applied on one page, every other page picks up the same window — the
    user's calendar choice is a preference, not per-page state. Stored as
    `{ custom: { start, end } }` (local ISO dates) or, for legacy payloads,
    `{ interval: "<preset>" }` under this single key. */
export const RANGE_KEY = "ams-date-range";

/** Older sessions kept a window per page — folded into the shared key by
    the first hydration that notices them, first page's choice wins. */
const LEGACY_KEYS = ["ams-reports-range", "ams-cash-range", "ams-activity-range"];

/** The stored window as concrete dates, re-anchored to NOW (presets like
    "This month" re-resolve each load). null = nothing saved yet — each
    page then keeps its own default. */
export function loadSharedWindow(): DateRange | null {
  try {
    let raw = localStorage.getItem(RANGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          raw = legacy;
          localStorage.removeItem(key);
        }
      }
      if (raw) localStorage.setItem(RANGE_KEY, raw);
    }
    const saved = raw
      ? (JSON.parse(raw) as { interval?: string; custom?: { start: string; end: string } } | null)
      : null;
    if (saved && typeof saved.interval === "string")
      return presetWindow(saved.interval);
    if (saved?.custom?.start && saved?.custom?.end)
      return {
        start: new Date(`${saved.custom.start}T00:00:00`),
        end: new Date(`${saved.custom.end}T23:59:59.999`),
      };
  } catch { /* storage unavailable — callers fall back to their defaults */ }
  return null;
}

/** Persist the window as concrete dates (local ISO) under the ONE key. */
export function saveSharedWindow(r: DateRange): void {
  try {
    localStorage.setItem(RANGE_KEY, JSON.stringify({ custom: { start: fmtISO(r.start), end: fmtISO(r.end) } }));
  } catch { /* storage unavailable — the filter still works */ }
}
