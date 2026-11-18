import { useState } from "react";
import { presetWindow } from "../components/DateRangePicker.tsx";
import type { DateRange } from "../components/DateRangePicker.tsx";
import { loadSharedWindow, saveSharedWindow } from "./sharedRange.ts";

/**
 * The pages' side of the DateRangePicker's state contract (Reports, Cash,
 * Activity — the pages whose filter IS the range):
 *
 *   selected — the active preset's label, or null (a custom range);
 *   range    — the concrete window the page renders.
 *
 * The window loads SYNCHRONOUSLY from the shared key on first render — so
 * a page's first fetch already uses the user's range, no wrong-window
 * flash, no refetch, and it never resets across pages or reloads.
 * Presets re-anchor to "now" on each load; a custom range restores its
 * exact dates. Nothing saved → the page's own default (Reports/Cash
 * "This month", Activity "All time"). Saving happens inside the mutator —
 * the USER's Apply persists, hydration never does. (Older sessions'
 * per-page keys and bar-preset `{ interval }` payloads hydrate once.)
 */
export default function useDateRange(defaultPreset: string) {
  const [{ selected, range }, setState] = useState(() => hydrate(defaultPreset));

  /** Popover Apply: confirm the window (marks the selection custom). */
  function applyCustom(r: DateRange): void {
    setState({ selected: null, range: r });
    saveSharedWindow(r);
  }

  return { selected, range, applyCustom };
}

/** The stored window for the first render — a preset re-anchors, a
    custom range restores its exact dates, nothing saved → the default. */
function hydrate(defaultPreset: string): { selected: string | null; range: DateRange } {
  const stored = loadSharedWindow();
  if (stored) {
    try {
      const raw = localStorage.getItem("ams-date-range");
      const saved = raw
        ? (JSON.parse(raw) as { interval?: string; custom?: { start: string; end: string } } | null)
        : null;
      // A saved preset keeps its chip highlighted (re-anchored to now);
      // concrete dates render as a custom selection.
      if (saved && typeof saved.interval === "string")
        return { selected: saved.interval, range: stored };
    } catch { /* chip highlight is cosmetic — the range stands */ }
    return { selected: null, range: stored };
  }
  return { selected: defaultPreset, range: presetWindow(defaultPreset) };
}
