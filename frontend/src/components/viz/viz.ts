import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Chart plumbing for the Reports visualisations. Palette note: the two
 * series hues (blue for money in, orange for money out) and the blue
 * ordinal ramp they derive from were run through the dataviz six-checks
 * validator against the app's white card surface — all checks pass
 * (CVD ΔE 24.7, normal-vision ΔE 33.6, both ≥ 3:1). The app's brand teal
 * was tried first and failed the chroma floor (reads gray as a data
 * colour), so the charts keep the validated pair instead.
 */
export const VIZ = {
  series1: "#2a78d6", // blue — money coming in / the led series
  series2: "#eb6834", // orange — money going out
  dumbStart: "#86b6ef", // ordinal light step — lent out
  dumbEnd: "#1c5cab", // ordinal dark step — recovered back
};

/** Track an element's rendered box so SVG charts re-render with it. */
export function useSize<T extends HTMLElement>(): [
  RefObject<T>,
  { w: number; h: number },
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** A clean tick step (1/2/2.5/5 × 10ⁿ) giving ~3–4 ticks over `span`. */
export function niceStep(span: number): number {
  if (span <= 0) return 1;
  const rough = span / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
}

/** Clean 0-based ticks up to a round max covering `max` — column axes. */
export function niceTicks(max: number): { top: number; step: number; ticks: number[] } {
  if (max <= 0) return { top: 1, step: 1, ticks: [0, 1] };
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, step, ticks };
}

/** Compact axis tick: en-IN style orders — 12.5K, 3.2L, 1.1Cr. */
export function fmtCompact(n: number): string {
  const trim = (x: number) => {
    const s = x.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${trim(n / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(n / 1e5)}L`;
  if (abs >= 1000) return `${trim(n / 1000)}K`;
  return `${Math.round(n)}`;
}

/** Clamp a number into [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Rough rendered width of a 10px SVG chart label (chars → px). */
export function labelPx(chars: number): number {
  return chars * 5.8;
}

/** A column path: 4px-rounded at the data end (top), square at the baseline. */
export function topRoundedPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, h, w / 2);
  return (
    `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y}` +
    ` L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
  );
}

/** A horizontal bar path: 4px-rounded at the data end (right), square baseline. */
export function rightRoundedPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w, h / 2);
  return (
    `M${x},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr}` +
    ` L${x + w},${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} L${x},${y + h} Z`
  );
}