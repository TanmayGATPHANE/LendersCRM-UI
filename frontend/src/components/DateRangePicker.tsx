import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, isBefore,
  isSameDay, isWithinInterval, startOfDay, startOfMonth, startOfWeek,
  startOfYear, endOfYear, subDays, subMonths, subYears, format,
} from "date-fns";

/**
 * DateRangePicker — the range selector shared by Reports, Cash
 * and Activity:
 *
 *   A calendar button showing the resolved concrete dates; clicking it
 *   opens a popover: a sidebar of named presets (Today … All time),
 *   twin month calendars (Monday-start) picked click-click (first click
 *   starts the range, second completes it, an earlier click swaps to
 *   start, hover previews the in-between), a footer of editable
 *   start/end date inputs and Apply/Cancel (Cancel restores the last
 *   confirmed range; Apply only fires when both dates exist).
 *
 * Generic by design: no page/domain imports in here — it receives the
 * confirmed `range` and the active `selected` preset label (null =
 * custom) and reports back through `onApply`; the pages own the state,
 * the fetches
 * and the persistence (see each page's hydration block). Dates here are
 * full-day bounds: data in this app is DATE (no time-of-day), so the
 * optional time inputs and hour/minute aggregation of the original spec
 * have no axis to work on and are left out.
 */

export interface DateRange {
  start: Date;
  end: Date;
}

/** The level-2 sidebar — named calendar presets. */
export const SIDEBAR_PRESETS = [
  "Today", "Yesterday", "This week", "Last week", "This month", "Last month",
  "This year", "Last year", "All time",
] as const;

/** Local ISO date (yyyy-mm-dd) for the pages' from/to APIs (DATE data). */
export function fmtISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** A preset name → its concrete dates, re-anchored to NOW every call. */
export function presetWindow(name: string): DateRange {
  const today = startOfDay(new Date());
  switch (name) {
    // DATE data counts calendar days — inclusive from/to, so "7D" is a
    // 7-day window ending today (start = today − 6). 6M/1Y stay sliding
    // month/year offsets, per the spec.
    case "24H": return { start: today, end: today };
    case "7D": return { start: subDays(today, 6), end: today };
    case "14D": return { start: subDays(today, 13), end: today };
    case "30D": return { start: subDays(today, 29), end: today };
    case "90D": return { start: subDays(today, 89), end: today };
    case "6M": return { start: startOfDay(subMonths(today, 6)), end: today };
    case "1Y": return { start: startOfDay(subYears(today, 1)), end: today };
    // Sidebar — full-day bounds (start 00:00:00, end end-of-day).
    case "Today": return { start: today, end: today };
    case "Yesterday": return { start: subDays(today, 1), end: subDays(today, 1) };
    case "This week":
      return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
    case "Last week": {
      const d = subDays(today, 7);
      return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) };
    }
    case "This month": return { start: startOfMonth(today), end: endOfMonth(today) };
    case "Last month": {
      const d = subMonths(today, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    case "This year": return { start: startOfYear(today), end: endOfYear(today) };
    case "Last year": {
      const d = subMonths(today, 12);
      return { start: startOfYear(d), end: endOfYear(d) };
    }
    case "All time": return { start: new Date(2000, 0, 1), end: today };
    default: return { start: today, end: today };
  }
}

// ---- the popover's own state (reducer) ----

interface PickerState {
  start: Date | null;
  end: Date | null; // null while mid-selection (first click done, second pending)
  hovered: Date | null;
  leftMonth: Date; // 1st of the left calendar's month
  sidebar: string | null; // sidebar preset highlighted inside the popover
}

type Action =
  | { type: "init"; range: DateRange }
  | { type: "pick"; day: Date }
  | { type: "hover"; day: Date | null }
  | { type: "sidebar"; label: string }
  | { type: "editStart"; day: Date }
  | { type: "editEnd"; day: Date }
  | { type: "move"; months: number };

function reducer(s: PickerState, a: Action): PickerState {
  switch (a.type) {
    case "init":
      return {
        start: a.range.start, end: a.range.end, hovered: null,
        leftMonth: startOfMonth(a.range.start), sidebar: null,
      };
    case "pick":
      // Fresh selection (nothing started, or one was already complete):
      // the click starts a new range and the next click completes it.
      if (s.start === null || (s.start && s.end)) {
        return { ...s, start: a.day, end: null, sidebar: null, hovered: a.day };
      }
      // Second click before the start: the earlier date swaps to start
      // and the previous start completes the range.
      if (isBefore(a.day, s.start)) {
        return { ...s, start: a.day, end: s.start, hovered: null, sidebar: null };
      }
      return { ...s, end: a.day, hovered: null, sidebar: null };
    case "hover":
      return { ...s, hovered: a.day };
    case "sidebar": {
      const w = presetWindow(a.label);
      return { ...s, start: w.start, end: w.end, sidebar: a.label, hovered: null, leftMonth: startOfMonth(w.start) };
    }
    case "editStart":
      return { ...s, start: a.day, sidebar: null }; // custom edits clear the sidebar highlight
    case "editEnd":
      return { ...s, end: a.day, sidebar: null };
    case "move":
      return { ...s, leftMonth: addMonths(s.leftMonth, a.months) };
  }
}

/** One month grid, Monday-start, dimmed days from the neighbour months. */
function Month({ month, ps, onPick, onHover }: {
  month: Date;
  ps: PickerState;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
}) {
  // Hover preview while the second click is pending.
  const selStart = ps.start && !ps.end && ps.hovered
    ? (isBefore(ps.hovered, ps.start) ? ps.hovered : ps.start)
    : ps.start;
  const selEnd = ps.start && !ps.end && ps.hovered
    ? (isBefore(ps.hovered, ps.start) ? ps.start : ps.hovered)
    : ps.end;

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const thisMonth = month.getMonth();

  const cell =
    "grid h-8 w-8 cursor-pointer select-none place-items-center rounded-full text-sm " +
    "transition-colors duration-300 ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  return (
    <div className="min-w-56">
      <div className="mb-1 text-center text-sm font-semibold text-ink">{format(month, "MMMM yyyy")}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => (
          <div key={w} className="grid h-8 w-8 place-items-center text-xs text-muted">{w}</div>
        ))}
        {days.map((d) => {
          const outside = d.getMonth() !== thisMonth;
          const isSelStart = selStart && isSameDay(d, selStart);
          const isSelEnd = selEnd && isSameDay(d, selEnd);
          const inside = selStart && selEnd && !isSelStart && !isSelEnd &&
            isWithinInterval(d, { start: selStart, end: selEnd });
          return (
            <button
              key={d.getTime()}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              onFocus={() => onHover(d)}
              onBlur={() => onHover(null)}
              className={
                isSelStart || isSelEnd
                  ? `bg-primary text-on-primary shadow-sm ${cell}`
                  : inside
                    ? `bg-tint-hover text-ink ${cell}`
                    : outside
                      ? `text-dim hover:bg-tint ${cell}`
                      : `text-slate hover:bg-tint ${cell}`
              }
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const chip =
  "px-3 py-1.5 text-sm rounded-md transition-colors duration-300 ease-brand " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer";
const chipActive = "bg-primary text-on-primary";
const chipIdle = "text-slate hover:bg-tint-hover";

export default function DateRangePicker({
  selected, range, onApply,
}: {
  selected: string | null; // the active preset's label (null = custom)
  range: DateRange; // the confirmed window the page renders
  onApply: (r: DateRange) => void; // popover Apply confirms a custom window
}) {
  const [open, setOpen] = useState(false);
  const [ps, dispatch] = useReducer(reducer, { start: null, end: null, hovered: null, leftMonth: startOfMonth(new Date()), sidebar: null });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  // Horizontal fit: the popover is wide, and the toolbars it drops from
  // can sit mid-page — so after opening, it is nudged (in px) to stay
  // inside the page <main>'s box (which overflow-clips at its edges).
  const [fitLeft, setFitLeft] = useState<number | null>(null);

  // Opening arms the popover with the last CONFIRMED range (Cancel undoes
  // to exactly this — nothing edits the page's state until Apply).
  function openPicker() {
    dispatch({ type: "init", range });
    setFitLeft(null); // re-measure fresh each open
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current, pop = popRef.current;
    if (!root || !pop) return;
    const rr = root.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const mr = (root.closest("main") ?? document.body).getBoundingClientRect();
    const w = pr.width, pad = 8;
    // Want the popover's right edge at the root's — unless that pushes
    // its left edge past main's left, or its right edge past main's
    // right (the box main clips at). Clamp the left edge into main.
    const leftInRoot = Math.min(Math.max(rr.right - w - mr.left, pad), mr.width - w - pad);
    setFitLeft(Math.max(pad, leftInRoot));
  }, [open, ps.leftMonth]); // re-measure when the calendars swap (single vs twin)

  // Click-outside and Escape close the popover (discarding the draft).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The grid's shared hover-clear — wiping the preview whenever the
  // pointer leaves either calendar.
  function clearHover() { dispatch({ type: "hover", day: null }); }

  const ready = ps.start !== null && ps.end !== null; // Apply only fires when both exist

  const sidebarList = useMemo(() => [...SIDEBAR_PRESETS], []);

  return (
    <div ref={rootRef} className="relative">
      {/* The calendar button (shows the resolved dates; opens the popover) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => (open ? setOpen(false) : openPicker())}
          aria-expanded={open}
          title="Pick a date range"
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-sm
                      transition-colors duration-300 ease-brand cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                      ${open || (selected === null && range)
                        ? "border-primary bg-tint text-primary ring-1 ring-primary/30"
                        : "border-line bg-card text-slate hover:bg-tint-hover"}`}
        >
          <i className="ph ph-calendar-blank text-base" aria-hidden="true" />
          {format(range.start, "MMM d, yyyy")} - {format(range.end, "MMM d, yyyy")}
        </button>
      </div>

      {/* Level 2 — the popover (nudged inside <main> by fitLeft) */}
      {open && (
        <div
          ref={popRef}
          style={fitLeft === null ? undefined : { right: "auto", left: `${fitLeft}px` }}
          className="absolute top-full z-50 mt-2 flex max-w-[calc(100vw-1.5rem)] rounded-xl
                     border border-line bg-card text-sm shadow-xl overflow-hidden"
        >
          {/* Sidebar of named presets (desktop: a column; smaller screens: chips) */}
          <div className="hidden w-40 shrink-0 flex-col gap-0.5 border-r border-line bg-tint p-2 lg:flex">
            {sidebarList.map((label) => (
              <button
                key={label}
                onClick={() => dispatch({ type: "sidebar", label })}
                className={`${chip} rounded-lg px-3 ${ps.sidebar === label ? `${chipActive} w-full text-left` : "text-slate hover:bg-tint-hover w-full text-left"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-3">
            {/* Twin calendars, always adjacent months (the second hides on phones) */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => dispatch({ type: "move", months: -1 })}
                title="Earlier"
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-dim hover:bg-tint-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <i className="ph ph-caret-left" aria-hidden="true" />
              </button>
              <div className="flex gap-6" onMouseLeave={clearHover}>
                <Month month={ps.leftMonth} ps={ps} onPick={(d) => dispatch({ type: "pick", day: d })} onHover={(d) => dispatch({ type: "hover", day: d })} />
                <div className="hidden lg:block" onMouseLeave={clearHover}>
                  <Month month={addMonths(ps.leftMonth, 1)} ps={ps} onPick={(d) => dispatch({ type: "pick", day: d })} onHover={(d) => dispatch({ type: "hover", day: d })} />
                </div>
              </div>
              <button
                onClick={() => dispatch({ type: "move", months: 1 })}
                title="Later"
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-dim hover:bg-tint-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <i className="ph ph-caret-right" aria-hidden="true" />
              </button>
            </div>

            {/* Smaller screens: the sidebar presets as inline chips */}
            <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
              {sidebarList.map((label) => (
                <button
                  key={label}
                  onClick={() => dispatch({ type: "sidebar", label })}
                  className={`${chip} rounded-lg px-2.5 ${ps.sidebar === label ? chipActive : "border border-line text-slate"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Footer: editable start/end inputs + Apply/Cancel */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <input
                type="date"
                value={ps.start ? fmtISO(ps.start) : ""}
                onChange={(e) => e.target.value && dispatch({ type: "editStart", day: startOfDay(new Date(e.target.value + "T00:00:00")) })}
                aria-label="From date"
                className="w-36 rounded-lg border border-line bg-tint px-2 py-1.5 text-sm text-ink outline-none transition-colors duration-300 ease-brand focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-xs text-muted">-</span>
              <input
                type="date"
                value={ps.end ? fmtISO(ps.end) : ""}
                min={ps.start ? fmtISO(ps.start) : undefined}
                onChange={(e) => e.target.value && dispatch({ type: "editEnd", day: endOfDay(new Date(e.target.value + "T00:00:00")) })}
                aria-label="To date"
                className="w-36 rounded-lg border border-line bg-tint px-2 py-1.5 text-sm text-ink outline-none transition-colors duration-300 ease-brand focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex-1" />
              <button
                onClick={() => setOpen(false)}
                className={`${chip} border border-line bg-tint hover:bg-tint-hover focus-visible:ring-primary/40`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!ready) return;
                  onApply({ start: startOfDay(ps.start as Date), end: endOfDay(ps.end as Date) });
                  setOpen(false);
                }}
                disabled={!ready}
                className={`${chip} ${ready
                  ? "bg-primary text-on-primary shadow-sm hover:bg-primary-hover focus-visible:ring-primary/40"
                  : "cursor-not-allowed bg-tint text-dim"}`}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}