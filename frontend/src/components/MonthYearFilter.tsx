import { selectCls } from "./ui.ts";

/**
 * MonthYearFilter — the date filtering shape used on EVERY page, like
 * the Dashboard's: two dropdowns (all months / all years allowed), no
 * calendar, no saved preference — every page opens on the current year
 * with all months showing. Select options feed from the page's own
 * years (pass the current list in; the current year always rides in).
 */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  month: string; // "all" or "01".."12"
  year: string; // "all" or "2022"
  years: string[];
  onMonth: (m: string) => void;
  onYear: (y: string) => void;
}

export default function MonthYearFilter({ month, year, years, onMonth, onYear }: Props) {
  // The dropdown ALWAYS offers the last five years — a year whose data
  // sits outside the current window's slice must still be selectable,
  // or its data becomes unreachable (the fetched slice can't suggest
  // the years it excludes). The page's own data years merge on top.
  const now = new Date().getFullYear();
  const base = [String(now), String(now - 1), String(now - 2), String(now - 3), String(now - 4)];
  const offered = [...new Set([...base, ...years])].sort().reverse();
  return (
    <>
      <select
        value={month}
        onChange={(e) => onMonth(e.target.value)}
        title="Filter by month"
        className={selectCls}
      >
        <option value="all">All months</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onYear(e.target.value)}
        title="Filter by year"
        className={selectCls}
      >
        <option value="all">All years</option>
        {offered.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </>
  );
}
