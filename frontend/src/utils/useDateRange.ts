import { useEffect, useState } from "react";
import { fmtISO, presetWindow } from "../components/DateRangePicker.tsx";
import type { DateRange } from "../components/DateRangePicker.tsx";

/**
 * The pages' side of the DateRangePicker's state contract:
 *
 *   selected — the active preset's label, or null (a custom range);
 *   range    — the concrete window the page renders.
 *
 * Saving happens inside the mutator — the USER's Apply persists, hydration
 * never does — as `{ custom: { start, end } }` (local ISO dates), keyed per
 * page so Reports, Cash and Activity each remember their own last window.
 * Nothing saved yet → the page's default preset. (Older sessions may have
 * saved a bar-preset `{ interval }`; hydration still honours it, re-anchored
 * to today.)
 */
export default function useDateRange(pageKey: string, defaultPreset: string) {
  const [selected, setSelected] = useState<string | null>(defaultPreset);
  const [range, setRange] = useState<DateRange>(() => presetWindow(defaultPreset));

  // Hydrate once on mount: interval → restore the preset (re-anchored to
  // now); custom → restore the exact dates (as local Dates); nothing
  // saved → the page's default stands.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(pageKey) ?? "null") as
        { interval?: string; custom?: { start: string; end: string } } | null;
      if (saved && typeof saved.interval === "string") {
        setSelected(saved.interval);
        setRange(presetWindow(saved.interval));
      } else if (saved?.custom?.start && saved?.custom?.end) {
        setSelected(null);
        setRange({
          start: new Date(`${saved.custom.start}T00:00:00`),
          end: new Date(`${saved.custom.end}T23:59:59.999`),
        });
      }
    } catch { /* storage unavailable — the default stands */ }
  }, [pageKey]);

  function persist(stateLike: { interval: string } | { custom: { start: string; end: string } }): void {
    try {
      localStorage.setItem(pageKey, JSON.stringify(stateLike));
    } catch { /* storage unavailable — the filter still works */ }
  }

  /** Popover Apply: confirm the window (marks the selection custom). */
  function applyCustom(r: DateRange): void {
    setRange(r);
    setSelected(null);
    persist({ custom: { start: fmtISO(r.start), end: fmtISO(r.end) } });
  }

  return { selected, range, applyCustom };
}