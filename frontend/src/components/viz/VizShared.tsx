import { useState, type ReactNode } from "react";

/**
 * Shared chrome for the Reports charts: the card each chart lives in,
 * the legend (always present once there are two series), and the hover
 * tooltip pieces. Text always wears text tokens — the colored mark
 * beside it carries the identity, never the text itself.
 */

/**
 * The card a chart lives in. Collapsible (the whole header row is the
 * toggle) — reports default collapsed so a big book reaches the data
 * below without scrolling past a wall of marks; opening is one click
 * and animates through the brand curve.
 */
export function ChartCard({ title, subtitle, legend, children, className = "", defaultCollapsed = false }: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  return (
    <section
      className={`rise-in flex min-w-0 flex-col rounded-xl border border-line bg-card p-4 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={open ? "Collapse chart" : "Expand chart"}
        className="-m-1 flex items-start justify-between gap-x-4 gap-y-1.5 rounded-lg p-1 text-left
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {legend}
          <i
            aria-hidden="true"
            className={`ph ph-caret-down text-base text-dim transition-transform duration-500 ease-brand
                        motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
          />
        </div>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-brand
                    motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="relative mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Legend for 2+ series — the dependable identity channel beside the marks. */
export function Legend({ items }: {
  items: { kind: "bar" | "line" | "dot"; color: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-slate">
          <span
            aria-hidden="true"
            className={
              it.kind === "bar" ? "h-2.5 w-2.5 rounded-[3px]"
              : it.kind === "dot" ? "h-2.5 w-2.5 rounded-full"
              : "h-0.5 w-3.5 rounded-full"
            }
            style={{ background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** The hover tooltip — a card floating over the plot; values lead. */
export function VizTip({ left, top, children }: { left: number; top: number; children: ReactNode }) {
  return (
    <div
      style={{ left, top }}
      className="anim-fade-in pointer-events-none absolute z-20 rounded-lg border border-line
                 bg-card px-2.5 py-2 shadow-lg"
    >
      {children}
    </div>
  );
}

/** One tooltip row: a short stroke of the series colour, then the value
    (strong — values lead) and the series name (secondary). */
export function TipRow({ swatch, label, value, valueClass = "text-ink" }: {
  swatch: string | null;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {swatch ? (
        <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: swatch }} />
      ) : null}
      <span className={`text-xs font-semibold tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}